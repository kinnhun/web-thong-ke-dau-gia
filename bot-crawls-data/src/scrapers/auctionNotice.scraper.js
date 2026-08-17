const config = require('../config');
const { fetchAPI } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const AssetItem = require('../models/AssetItem');
const CrawlLog = require('../models/CrawlLog');
const { fetchAuctionItemDetail, handleDuplicate, searchDuplicatesByFuzzyName, searchDuplicatesByAssetItem, extractAssetItemsFromNotice, mergeIdenticalAssetGroups, rebuildAllDuplicateEntries, recrawlMissingAuctionDetails } = require('./detail.scraper');
const { slugify, mapAssetType, parseDate, extractProvince, deriveStatus, delay, isBatchNotice } = require('../utils/helpers');

const API = config.endpoints.auctionNoticeList;
const BASE = config.baseUrl;
const SKIP_THRESHOLD = config.crawl.skipThreshold || 50;

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

async function saveExtractedAssetItems(doc, sourceType = 'auction') {
  try {
    const items = extractAssetItemsFromNotice(doc, sourceType);
    if (!items || items.length === 0) return;
    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { sourceType, sourceId: item.sourceId, itemIndex: item.itemIndex },
        update: { $set: item },
        upsert: true
      }
    }));
    await AssetItem.bulkWrite(bulkOps, { ordered: false });
  } catch (e) {
    // ignore non-fatal bulk write errors
  }
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
  const MIN_PAGES_BEFORE_EARLY_STOP = 3;

  console.log(`\n🚀 Cào Thông Báo Đấu Giá từ trang ${startPage}... (Skip threshold: ${SKIP_THRESHOLD} bản cũ liên tiếp, min pages: ${MIN_PAGES_BEFORE_EARLY_STOP})`);

  try {
    const firstRes = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize, typeOrder: 2 });
    if (!firstRes || !firstRes.items) throw new Error('Không thể fetch trang đầu');

    totalPages = firstRes.pageCount || 1;
    if (maxPages > 0) totalPages = Math.min(totalPages, maxPages + startPage - 1);
    log.totalPages = totalPages;
    console.log(`📊 Server: ${firstRes.rowCount} items, ${totalPages} pages`);

    const r = await processItems(firstRes.items, stats, { isAuto, prevOld: consecutiveOld, listOnly });
    consecutiveOld = r.consecutiveOld;
    if (!listOnly && isAuto && currentPage >= MIN_PAGES_BEFORE_EARLY_STOP && (r.reachedThreshold || consecutiveOld >= SKIP_THRESHOLD)) {
      earlyStop = true;
      console.log(`🛑 [Auto-crawl] Gặp ${SKIP_THRESHOLD} tài sản trùng id (đã có trong DB) liên tiếp -> Dừng sớm ở trang ${currentPage}.`);
    }
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
          if (!listOnly && isAuto && currentPage >= MIN_PAGES_BEFORE_EARLY_STOP && (r2.reachedThreshold || consecutiveOld >= SKIP_THRESHOLD)) {
            earlyStop = true;
            console.log(`🛑 [Auto-crawl] Gặp ${SKIP_THRESHOLD} tài sản trùng id (đã có trong DB) liên tiếp -> Dừng sớm ở trang ${currentPage}.`);
          }
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

    // Chạy sync duplicate cho các bản ghi mới vừa cào
    if (stats.inserted > 0) {
      try {
        console.log(`\n🔄 [Post-Crawl] Đang đồng bộ AssetItem & ghép duplicate cho ${stats.inserted} bài mới...`);
        await mergeIdenticalAssetGroups('auction');
        await rebuildAllDuplicateEntries(null, null, { type: 'auction' });
      } catch (e) {
        console.error('⚠️ Post-crawl duplicate sync warning:', e.message);
      }
    }

    // Tự động cào bù chi tiết nếu có bài trong DB chưa cào được chi tiết
    try {
      const incompleteDocs = await AuctionNotice.find({ detailScraped: { $ne: true } }).select('sourceId').limit(30).lean();
      if (incompleteDocs.length > 0) {
        console.log(`\n🔄 [Post-Crawl] Tự động cào bù chi tiết cho ${incompleteDocs.length} bài chưa hoàn thành...`);
        const incIds = incompleteDocs.map(d => d.sourceId);
        await recrawlMissingAuctionDetails(incIds);
      }
    } catch (e) {
      console.error('⚠️ Post-crawl missing details recrawl warning:', e.message);
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

  // ⚡ Batch check: Lấy thông tin sourceId và cờ detailScraped
  const sourceIds = items.map(i => Number(i.id)).filter(Boolean);
  const existingDocs = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).select('sourceId detailScraped').lean();
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
          break; // Dừng gom thêm item cũ trên trang này, nhưng PHẢI xử lý hết newItems đã thu thập
        }
      }
    } else {
      if (isAuto) consecutiveOld = 0; // Gặp bài mới hoặc bài thiếu chi tiết -> Reset số bài cũ liên tiếp
      newItems.push(item);
    }
  }

  if (listOnly && newItems.length > 0) {
    const docs = newItems.map((item) => {
      const sourceId = Number(item.id);
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

    return { consecutiveOld, reachedThreshold };
  }

  // ⚡ Xử lý newItems: Cào detail + Lưu DB + Bóc tách AssetItem + Ghép trùng lặp
  const concurrency = 1;
  for (let i = 0; i < newItems.length; i += concurrency) {
    const chunk = newItems.slice(i, i + concurrency);
    const results = await Promise.allSettled(chunk.map(async (item) => {
      const sourceId = Number(item.id);
      const data = buildAuctionData(item);
      data.sourceId = sourceId;
      data.lastCrawledAt = new Date();

      try {
        const { updates, files } = await fetchAuctionItemDetail(sourceId, data.name);
        Object.assign(data, updates);
        if (files && files.length > 0) data.files = files;
        data.detailScraped = true;
        
        let relatedIds = data.relatedIds || [];
        try {
          const localMatchedIds = await searchDuplicatesByFuzzyName(sourceId, data.name, 'auction', true, data.province);
          if (localMatchedIds && localMatchedIds.length > 0) {
            relatedIds = [...new Set([...relatedIds, ...localMatchedIds])];
          }
        } catch (e) {}
        
        await delay(1500 + Math.random() * 1500); // Thêm delay tránh anti-bot
        return { data, hasDetail: true, relatedIds, sourceId, name: data.name };
      } catch (e) {
        data.detailScraped = false;
        return { data, hasDetail: false, relatedIds: [], sourceId, name: data.name };
      }
    }));

    // Lưu DB tuần tự tránh race condition (Dùng findOneAndUpdate để upsert an toàn)
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { data, hasDetail, relatedIds, sourceId, name } = result.value;
        try {
          const createdDoc = await AuctionNotice.findOneAndUpdate(
            { sourceId },
            { $set: data },
            { upsert: true, new: true }
          );
          stats.inserted++;
          stats.recentNotices.unshift({
            sourceId,
            name: data.name,
            province: data.province || '',
            publishedAt: data.publishedAt || null,
          });
          stats.recentNotices = stats.recentNotices.slice(0, 8);
          if (hasDetail) stats.detailOk++;

          // Bóc tách AssetItem cho bản ghi mới tạo/cập nhật
          await saveExtractedAssetItems(createdDoc, 'auction');

          // Ghép trùng lặp cấp độ sub-asset tức thì
          let combinedRelatedIds = relatedIds || [];
          try {
            const subAssetMatchedIds = await searchDuplicatesByAssetItem(sourceId, createdDoc, 'auction');
            if (subAssetMatchedIds && subAssetMatchedIds.length > 0) {
              combinedRelatedIds = [...new Set([...combinedRelatedIds, ...subAssetMatchedIds])];
            }
          } catch (e) {}

          if (combinedRelatedIds && combinedRelatedIds.length > 0) {
            await handleDuplicate(sourceId, name, combinedRelatedIds, 'auction');
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

  return { consecutiveOld, reachedThreshold };
}

function buildAuctionData(item) {
  const sourceId = Number(item.id);
  const name = item.propertyName || item.subPropertyName || item.titleName || item.nameAsset || item.assetName || item.title || item.name || '';
  const shortDescription = item.subPropertyName || item.titleName || '';
  const propertyTypeName = item.propertyTypeName || '';
  const type = mapAssetType(propertyTypeName, name);
  const province = resolveAuctionProvince(item, name, shortDescription);
  const slug = slugify(shortDescription || name);

  // Thử tất cả các trường giá khởi điểm từ API danh sách
  const initialPriceRaw = item.startingPrice || item.initialPrice || item.price || item.startPrice || item.propertyPrice;
  const initialPrice = initialPriceRaw ? Number(initialPriceRaw) : undefined;

  // Thử tất cả các trường ngày xuất bản từ API
  const publishedAt = parseDate(item.publishedAt)
    || parseDate(item.publishTime1)
    || parseDate(item.publishTime2)
    || parseDate(item.publishTime)
    || parseDate(item.createdDate)
    || parseDate(item.lastUpdated)
    || parseDate(item.aucRegTimeStart)
    || parseDate(item.aucTime);

  const auctionDate = parseDate(item.aucTime) || parseDate(item.auctionDate);
  const registrationStart = parseDate(item.aucRegTimeStart) || parseDate(item.registrationStart);
  const registrationEnd = parseDate(item.aucRegTimeEnd) || parseDate(item.registrationEnd);

  const organizer = item.org_name || item.organizer || item.orgName || item.organizerName || '';
  const owner = item.fullname || item.owner || item.ownerName || item.sellerName || '';

  return {
    sourceId,
    name, shortDescription, titleName: item.titleName || '', slug, type, province,
    initialPrice, currentPrice: initialPrice,
    propertyTypeId: item.propertyTypeId, propertyTypeName,
    publishedAt, auctionDate, registrationStart, registrationEnd,
    organizer, owner,
    sourceUrl: `${BASE}${config.endpoints.auctionDetailBase}/${slug}-${item.id}.html`,
    status: deriveStatus(registrationEnd, auctionDate),
    isBatchNotice: isBatchNotice(name),
  };
}

module.exports = { crawlAuctionNotices };


