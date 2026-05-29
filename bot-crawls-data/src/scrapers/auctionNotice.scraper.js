/**
 * Scraper: Thông báo công khai việc đấu giá
 * List + Detail + Duplicate (all-in-one)
 */
const config = require('../config');
const { fetchAPI } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const CrawlLog = require('../models/CrawlLog');
const { fetchAuctionItemDetail, handleDuplicate, searchDuplicatesByFuzzyName } = require('./detail.scraper');
const { slugify, mapAssetType, parseDate, extractProvince, deriveStatus, delay } = require('../utils/helpers');

const API = config.endpoints.auctionNoticeList;
const BASE = config.baseUrl;
const SKIP_THRESHOLD = config.crawl.skipThreshold;

function resolveAuctionProvince(item, name, shortDescription) {
  const directProvince = item.provinceName
    || item.province_name
    || item.province
    || item.cityName
    || item.city_name
    || item.addressProvince
    || item.propertyProvince;

  if (directProvince) return directProvince;

  return extractProvince([
    name,
    shortDescription,
    item.titleName,
    item.fullname,
    item.org_name,
    item.address,
    item.propertyPlace,
  ].filter(Boolean).join(' '));
}

async function crawlAuctionNotices(options = {}) {
  const pageSize = options.pageSize || config.crawl.pageSize;
  const startPage = options.startPage || 1;
  const maxPages = Number.isFinite(Number(options.maxPages)) ? Number(options.maxPages) : config.crawl.maxPages;
  const isAuto = options.isAuto === true || options.isAuto === 'true';
  const listOnly = options.listOnly === true || options.listOnly === 'true';

  const log = await CrawlLog.create({
    type: 'auction_notice', startedAt: new Date(), status: 'running',
    itemsInserted: 0, itemsUpdated: 0, itemsSkipped: 0, pagesProcessed: 0, totalPages: 0, errorMessages: [], recentNotices: [],
    lastPage: Math.max(startPage - 1, 0),
  });

  let currentPage = startPage;
  let totalPages = 1;
  let stats = { inserted: 0, updated: 0, skipped: 0, errors: 0, detailOk: 0, duplicates: 0, recentNotices: [] };
  let consecutiveOld = 0;
  let earlyStop = false;

  console.log(`\n🚀 Cào Thông Báo Đấu Giá từ trang ${startPage}...`);

  try {
    const firstRes = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize, typeOrder: 2 });
    if (!firstRes || !firstRes.items) throw new Error('Không thể fetch trang đầu');

    totalPages = firstRes.pageCount || 1;
    if (maxPages > 0) totalPages = Math.min(totalPages, maxPages + startPage - 1);
    log.totalPages = totalPages;
    console.log(`📊 Server: ${firstRes.rowCount} items, ${totalPages} pages`);

    const r = await processItems(firstRes.items, stats, { isAuto, consecutiveOld, listOnly });
    consecutiveOld = r.consecutiveOld;
    if (!listOnly && isAuto && consecutiveOld >= SKIP_THRESHOLD) earlyStop = true;
    log.pagesProcessed = 1;
    log.lastPage = currentPage;
    log.itemsInserted = stats.inserted;
    log.itemsUpdated = stats.updated;
    log.itemsSkipped = stats.skipped;
    log.recentNotices = stats.recentNotices;
    await log.save();
    currentPage++;

    while (currentPage <= totalPages && !earlyStop) {
      await delay(config.crawl.delayMs);
      try {
        const res = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize, typeOrder: 2 });
        if (res && res.items) {
          const r2 = await processItems(res.items, stats, { isAuto, prevOld: consecutiveOld, listOnly });
          consecutiveOld = r2.consecutiveOld;
          if (!listOnly && isAuto && consecutiveOld >= SKIP_THRESHOLD) earlyStop = true;
        }
      } catch (err) {
        stats.errors++;
        log.errorMessages.push(`P${currentPage}: ${err.message}`);
      }
      log.pagesProcessed = currentPage - startPage + 1;
      log.lastPage = currentPage;
      log.itemsInserted = stats.inserted;
      log.itemsUpdated = stats.updated;
      log.itemsSkipped = stats.skipped;
      log.recentNotices = stats.recentNotices;
      if (currentPage % 5 === 0) {
        await log.save();
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
  log.recentNotices = stats.recentNotices;
  if (!log.lastPage) {
    log.lastPage = Math.max(startPage - 1, 0);
  }
  await log.save();
  return stats;
}

async function processItems(items, stats, options = {}) {
  const isAuto = options.isAuto === true || options.isAuto === 'true';
  let consecutiveOld = options.prevOld || 0;
  const listOnly = options.listOnly === true || options.listOnly === 'true';
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

  if (listOnly && newItems.length > 0) {
    const docs = newItems.map((item) => {
      const sourceId = item.id;
      const data = buildAuctionData(item);
      data.sourceId = sourceId;
      data.lastCrawledAt = new Date();
      data.detailScraped = false;
      return data;
    });

    try {
      const inserted = await AuctionNotice.insertMany(docs, { ordered: false });
      stats.inserted += inserted.length;
      for (const data of inserted.slice(-8).reverse()) {
        stats.recentNotices.unshift({
          sourceId: data.sourceId,
          name: data.name,
          province: data.province || '',
          publishedAt: data.publishedAt || null,
        });
      }
      stats.recentNotices = stats.recentNotices.slice(0, 8);
    } catch (err) {
      const insertedCount = Array.isArray(err.insertedDocs) ? err.insertedDocs.length : 0;
      stats.inserted += insertedCount;
      stats.skipped += Array.isArray(err.writeErrors) ? err.writeErrors.filter((writeError) => writeError?.code === 11000).length : 0;
      stats.errors += Array.isArray(err.writeErrors) ? err.writeErrors.filter((writeError) => writeError?.code !== 11000).length : 1;
    }

    return { consecutiveOld };
  }

  // ⚡ Xử lý items mới tuần tự từng bài một để tránh anti-bot
  const concurrency = 1;
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
        
        // ★ Auto-crawl: chỉ dùng relatedIds từ API (nhanh), BỎ fuzzy search (chậm)
        // Fuzzy search sẽ chạy riêng trong duplicate_scan job
        const relatedIds = data.relatedIds || [];
        
        await delay(1500 + Math.random() * 1500); // Thêm delay tránh anti-bot
        return { data, hasDetail: true, relatedIds, sourceId, name: data.name };
      } catch (e) {
        data.detailScraped = false;
        return { data, hasDetail: false, relatedIds: [], sourceId, name: data.name };
      }
    }));

    // Lưu DB tuần tự tránh race condition
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { data, hasDetail, relatedIds, sourceId, name } = result.value;
        try {
          await AuctionNotice.create(data);
          stats.inserted++;
          stats.recentNotices.unshift({
            sourceId,
            name: data.name,
            province: data.province || '',
            publishedAt: data.publishedAt || null,
          });
          stats.recentNotices = stats.recentNotices.slice(0, 8);
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
  const name = item.propertyName || item.subPropertyName || item.titleName || '';
  const shortDescription = item.subPropertyName || '';
  const propertyTypeName = item.propertyTypeName || '';
  const type = mapAssetType(propertyTypeName, name);
  const province = resolveAuctionProvince(item, name, shortDescription);
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
