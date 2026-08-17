/**
 * Scraper: Thông báo lựa chọn tổ chức đấu giá
 * List + Detail (all-in-one)
 */
const config = require('../config');
const { fetchAPI } = require('../browser');
const OrgSelection = require('../models/OrgSelection');
const CrawlLog = require('../models/CrawlLog');
const { fetchOrgItemDetail } = require('./detail.scraper');
const { slugify, parseDate, extractProvince, delay } = require('../utils/helpers');

const BASE = config.baseUrl;
const API = config.endpoints.orgSelectionList;
const SKIP_THRESHOLD = config.crawl.skipThreshold;

async function crawlOrgSelections(options = {}) {
  const pageSize = options.pageSize || config.crawl.pageSize;
  const startPage = options.startPage || 1;
  const maxPages = options.maxPages || config.crawl.maxPages;
  const isAuto = options.isAuto || false;

  const log = await CrawlLog.create({
    type: 'org_selection', startedAt: new Date(),
    itemsInserted: 0, itemsUpdated: 0, itemsSkipped: 0, pagesProcessed: 0, errorMessages: [],
  });

  let currentPage = startPage;
  let totalPages = 1;
  let stats = { inserted: 0, updated: 0, skipped: 0, errors: 0, detailOk: 0 };
  let consecutiveOld = 0;
  let earlyStop = false;

  console.log(`\n🚀 Cào Lựa Chọn Tổ Chức ĐG từ trang ${startPage}... (Skip threshold: ${SKIP_THRESHOLD} bản cũ liên tiếp)`);

  try {
    const firstRes = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize, typeOrder: 2 });
    if (!firstRes || !firstRes.items) throw new Error('Không thể fetch trang đầu');

    totalPages = firstRes.pageCount || 1;
    if (maxPages > 0) totalPages = Math.min(totalPages, maxPages + startPage - 1);
    console.log(`📊 Server: ${firstRes.rowCount} items, ${totalPages} pages`);

    const r = await processItems(firstRes.items, stats, { isAuto, prevOld: consecutiveOld });
    consecutiveOld = r.consecutiveOld;
    if (isAuto && (r.reachedThreshold || consecutiveOld >= SKIP_THRESHOLD)) {
      earlyStop = true;
      console.log(`🛑 [Auto-crawl Org] Gặp ${SKIP_THRESHOLD} bản ghi cũ liên tiếp -> Dừng sớm ở trang ${currentPage}.`);
    }
    log.pagesProcessed = 1;
    currentPage++;

    while (currentPage <= totalPages && !earlyStop) {
      await delay(config.crawl.delayMs);
      try {
        const res = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize, typeOrder: 2 });
        if (res && res.items) {
          const r2 = await processItems(res.items, stats, { isAuto, prevOld: consecutiveOld });
          consecutiveOld = r2.consecutiveOld;
          if (isAuto && (r2.reachedThreshold || consecutiveOld >= SKIP_THRESHOLD)) {
            earlyStop = true;
            console.log(`🛑 [Auto-crawl Org] Gặp ${SKIP_THRESHOLD} bản ghi cũ liên tiếp -> Dừng sớm ở trang ${currentPage}.`);
          }
        }
      } catch (err) {
        stats.errors++;
        log.errorMessages.push(`P${currentPage}: ${err.message}`);
      }
      log.pagesProcessed = currentPage - startPage + 1;
      if (currentPage % 5 === 0) {
        console.log(`  📄 P${currentPage}/${totalPages} | +${stats.inserted} | detail=${stats.detailOk}`);
      }
      currentPage++;
    }

    log.status = earlyStop ? 'early_stopped' : 'completed';
    console.log(`✅ OrgSelection ${earlyStop ? '(early-stop)' : ''} | +${stats.inserted} | detail=${stats.detailOk}`);
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

  // ⚡ Batch check: Lấy sourceId và cờ detailScraped
  const sourceIds = items.map(i => Number(i.id)).filter(Boolean);
  const existingDocs = await OrgSelection.find({ sourceId: { $in: sourceIds } }).select('sourceId detailScraped').lean();
  const existingMap = new Map(existingDocs.map(d => [Number(d.sourceId), d.detailScraped === true]));

  const newItems = [];
  let reachedThreshold = false;

  for (const item of items) {
    const sourceId = Number(item.id);
    if (!sourceId) { stats.skipped++; continue; }

    const isFullyScraped = existingMap.has(sourceId) && existingMap.get(sourceId) === true;

    if (isFullyScraped) {
      stats.skipped++;
      if (isAuto) {
        consecutiveOld++;
        if (consecutiveOld >= SKIP_THRESHOLD) {
          reachedThreshold = true;
          break;
        }
      }
    } else {
      if (isAuto) consecutiveOld = 0;
      newItems.push(item);
    }
  }

  // ⚡ Xử lý items mới tuần tự từng bài một để tránh anti-bot
  const concurrency = 1;
  for (let i = 0; i < newItems.length; i += concurrency) {
    const chunk = newItems.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map(async (item) => {
      const sourceId = Number(item.id);
      const data = buildOrgData(item);
      data.sourceId = sourceId;
      data.lastCrawledAt = new Date();

      try {
        const { updates, files } = await fetchOrgItemDetail(sourceId);
        Object.assign(data, updates);
        if (files && files.length > 0) data.files = files;
        data.detailScraped = true;
        
        await delay(1500 + Math.random() * 1500); // Thêm delay tránh anti-bot
        return { data, hasDetail: true };
      } catch (e) {
        data.detailScraped = false;
        return { data, hasDetail: false };
      }
    }));

    // Lưu DB tuần tự bằng findOneAndUpdate (upsert an toàn)
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { data, hasDetail } = result.value;
        try {
          await OrgSelection.findOneAndUpdate(
            { sourceId: data.sourceId },
            { $set: data },
            { upsert: true, new: true }
          );
          stats.inserted++;
          if (hasDetail) stats.detailOk++;
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
  return { consecutiveOld, reachedThreshold };
}

function buildOrgData(item) {
  const name = item.propertyName || item.subPropertyName || item.titleName || item.nameAsset || item.assetName || item.title || item.name || '';
  const shortDescription = item.subPropertyName || item.titleName || '';
  const slug = slugify(shortDescription || name);
  const province = extractProvince(name + ' ' + shortDescription);

  const startingPriceRaw = item.startingPrice || item.initialPrice || item.price || item.startPrice || item.propertyPrice;
  const startingPrice = startingPriceRaw ? Number(startingPriceRaw) : undefined;
  const owner = item.fullname || item.owner || item.ownerName || item.sellerName || '';
  const organizer = item.org_name || item.organizer || item.orgName || item.organizerName || '';

  return {
    name, shortDescription, slug,
    owner, organizer,
    startingPrice,
    publishedAt: parseDate(item.lastUpdated || item.publishedAt),
    lastUpdated: parseDate(item.lastUpdated),
    receiveTimeStart: parseDate(item.receiveTimeStart),
    receiveTimeEnd: parseDate(item.receiveTimeEnd),
    propertyTypeId: item.propertyTypeId,
    propertyTypeName: item.propertyTypeName || '',
    province,
    sourceUrl: `${BASE}${config.endpoints.orgDetailBase}/${slug}-${item.id}.html`,
  };
}

module.exports = { crawlOrgSelections };
