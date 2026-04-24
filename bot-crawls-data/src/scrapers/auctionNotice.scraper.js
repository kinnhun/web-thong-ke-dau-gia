/**
 * Scraper: Thông báo công khai việc đấu giá
 * List + Detail + Duplicate (all-in-one)
 */
const config = require('../config');
const { fetchAPI } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const CrawlLog = require('../models/CrawlLog');
const { fetchAuctionItemDetail, handleDuplicate } = require('./detail.scraper');
const { slugify, mapAssetType, parseDate, extractProvince, deriveStatus, delay } = require('../utils/helpers');

const API = config.endpoints.auctionNoticeList;
const BASE = config.baseUrl;
const SKIP_THRESHOLD = config.crawl.skipThreshold;

async function crawlAuctionNotices(options = {}) {
  const pageSize = options.pageSize || config.crawl.pageSize;
  const startPage = options.startPage || 1;
  const maxPages = options.maxPages || config.crawl.maxPages;
  const isAuto = options.isAuto || false;

  const log = await CrawlLog.create({
    type: 'auction_notice', startedAt: new Date(),
    itemsInserted: 0, itemsUpdated: 0, itemsSkipped: 0, pagesProcessed: 0, errorMessages: [],
  });

  let currentPage = startPage;
  let totalPages = 1;
  let stats = { inserted: 0, updated: 0, skipped: 0, errors: 0, detailOk: 0, duplicates: 0 };
  let consecutiveOld = 0;
  let earlyStop = false;

  console.log(`\n🚀 Cào Thông Báo Đấu Giá từ trang ${startPage}...`);

  try {
    const firstRes = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize });
    if (!firstRes || !firstRes.items) throw new Error('Không thể fetch trang đầu');

    totalPages = firstRes.pageCount || 1;
    if (maxPages > 0) totalPages = Math.min(totalPages, maxPages + startPage - 1);
    console.log(`📊 Server: ${firstRes.rowCount} items, ${totalPages} pages`);

    const r = await processItems(firstRes.items, stats, { isAuto, consecutiveOld });
    consecutiveOld = r.consecutiveOld;
    if (isAuto && consecutiveOld >= SKIP_THRESHOLD) earlyStop = true;
    log.pagesProcessed = 1;
    currentPage++;

    while (currentPage <= totalPages && !earlyStop) {
      await delay(config.crawl.delayMs);
      try {
        const res = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize });
        if (res && res.items) {
          const r2 = await processItems(res.items, stats, { isAuto, prevOld: consecutiveOld });
          consecutiveOld = r2.consecutiveOld;
          if (isAuto && consecutiveOld >= SKIP_THRESHOLD) earlyStop = true;
        }
      } catch (err) {
        stats.errors++;
        log.errorMessages.push(`P${currentPage}: ${err.message}`);
      }
      log.pagesProcessed = currentPage - startPage + 1;
      if (currentPage % 5 === 0) {
        console.log(`  📄 P${currentPage}/${totalPages} | +${stats.inserted} | detail=${stats.detailOk} | dup=${stats.duplicates}`);
      }
      currentPage++;
    }

    log.status = earlyStop ? 'early_stopped' : 'completed';
    console.log(`✅ Auction ${earlyStop ? '(early-stop)' : ''} | +${stats.inserted} | detail=${stats.detailOk} | dup=${stats.duplicates}`);
  } catch (err) {
    log.status = 'failed';
    log.errorMessages.push(err.message);
    console.error(`❌ Crawl thất bại: ${err.message}`);
  }

  log.finishedAt = new Date();
  log.itemsInserted = stats.inserted;
  log.itemsUpdated = stats.updated;
  log.itemsSkipped = stats.skipped;
  await log.save();
  return stats;
}

async function processItems(items, stats, options = {}) {
  const isAuto = options.isAuto || false;
  let consecutiveOld = options.prevOld || 0;

  // ⚡ Batch check: 1 query thay vì N queries
  const sourceIds = items.map(i => i.id).filter(Boolean);
  const existingDocs = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).select('sourceId').lean();
  const existingSet = new Set(existingDocs.map(d => d.sourceId));

  // Phân loại: cũ vs mới
  const newItems = [];
  for (const item of items) {
    const sourceId = item.id;
    if (!sourceId) { stats.skipped++; continue; }

    if (existingSet.has(sourceId)) {
      stats.skipped++;
      if (isAuto) {
        consecutiveOld++;
        if (consecutiveOld >= SKIP_THRESHOLD) return { consecutiveOld };
      }
    } else {
      if (isAuto) consecutiveOld = 0;
      newItems.push(item);
    }
  }

  // ⚡ Xử lý items mới theo chunk song song
  const concurrency = config.crawl.concurrency || 5;
  for (let i = 0; i < newItems.length; i += concurrency) {
    const chunk = newItems.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map(async (item) => {
      const sourceId = item.id;
      const data = buildAuctionData(item);
      data.sourceId = sourceId;
      data.lastCrawledAt = new Date();

      try {
        const { updates, files } = await fetchAuctionItemDetail(sourceId);
        Object.assign(data, updates);
        if (files.length > 0) data.files = files;
        data.detailScraped = true;
        return { data, hasDetail: true, relatedIds: data.relatedIds, sourceId, name: data.name };
      } catch (e) {
        data.detailScraped = false;
        return { data, hasDetail: false, sourceId, name: data.name };
      }
    }));

    // Lưu DB tuần tự tránh race condition
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { data, hasDetail, relatedIds, sourceId, name } = result.value;
        try {
          await AuctionNotice.create(data);
          stats.inserted++;
          if (hasDetail) stats.detailOk++;

          if (relatedIds && relatedIds.length > 0) {
            await handleDuplicate(sourceId, name, relatedIds, 'auction');
            stats.duplicates++;
          }
        } catch (err) {
          if (err.code === 11000) {
            stats.skipped++;
            if (isAuto) consecutiveOld++;
          } else {
            stats.errors++;
          }
        }
      } else {
        stats.errors++;
      }
    }
  }
  return { consecutiveOld };
}

function buildAuctionData(item) {
  const name = item.propertyName || item.subPropertyName || '';
  const shortDescription = item.subPropertyName || '';
  const propertyTypeName = item.propertyTypeName || '';
  const type = mapAssetType(propertyTypeName, name);
  const province = extractProvince(name + ' ' + shortDescription);
  const slug = slugify(shortDescription || name);
  const publishedAt = parseDate(item.publishTime1) || parseDate(item.publishTime2);
  const auctionDate = parseDate(item.aucTime);
  const registrationStart = parseDate(item.aucRegTimeStart);
  const registrationEnd = parseDate(item.aucRegTimeEnd);

  return {
    name, shortDescription, titleName: item.titleName || '', slug, type, province,
    propertyTypeId: item.propertyTypeId, propertyTypeName,
    publishedAt, auctionDate, registrationStart, registrationEnd,
    organizer: item.org_name || '', owner: item.fullname || '',
    sourceUrl: `${BASE}${config.endpoints.auctionDetailBase}/${slug}-${item.id}.html`,
    status: deriveStatus(registrationEnd, auctionDate),
  };
}

module.exports = { crawlAuctionNotices };
