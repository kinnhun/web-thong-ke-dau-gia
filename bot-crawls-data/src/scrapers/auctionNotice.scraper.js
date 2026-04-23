const config = require('../config');
const { fetchAPI } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const AuctionSample = require('../models/AuctionSample');
const CrawlLog = require('../models/CrawlLog');
const { slugify, mapAssetType, parseDate, extractProvince, deriveStatus, delay } = require('../utils/helpers');

const BASE = config.baseUrl;
const API = config.endpoints.auctionNoticeList;
const SKIP_THRESHOLD = config.crawl.skipThreshold; // 20 bản cũ liên tiếp → dừng

/**
 * Cào danh sách thông báo đấu giá
 * 
 * Logic early-stop:
 *   - Data mới → lưu vào DB, reset bộ đếm cũ
 *   - Data đã có → tăng bộ đếm cũ liên tiếp
 *   - Bộ đếm >= SKIP_THRESHOLD (20) → dừng, chờ đợt sau
 */
async function crawlAuctionNotices(options = {}) {
  const pageSize = options.pageSize || config.crawl.pageSize;
  const startPage = options.startPage || 1;
  const maxPages = options.maxPages || config.crawl.maxPages;

  const log = await CrawlLog.create({
    type: 'auction_notice',
    startedAt: new Date(),
    itemsInserted: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    pagesProcessed: 0,
    errorMessages: [],
  });

  let currentPage = startPage;
  let totalPages = 1;
  let stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  let consecutiveOld = 0; // Bộ đếm bản ghi cũ liên tiếp
  let earlyStop = false;

  console.log(`\n🚀 Bắt đầu cào Thông báo đấu giá từ trang ${startPage}...`);
  console.log(`   ⚡ Early-stop: dừng khi gặp ${SKIP_THRESHOLD} bản cũ liên tiếp`);

  try {
    // Fetch first page
    const firstRes = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize });
    if (!firstRes || !firstRes.items) {
      throw new Error('Không thể fetch trang đầu tiên');
    }

    totalPages = firstRes.pageCount || 1;
    const totalItems = firstRes.rowCount || 0;

    if (maxPages > 0) {
      totalPages = Math.min(totalPages, maxPages + startPage - 1);
    }

    console.log(`📊 Tổng trên server: ${totalItems} items, ${totalPages} pages`);
    log.totalPages = totalPages;

    // Process first page
    const firstResult = await processItems(firstRes.items, stats);
    consecutiveOld = firstResult.consecutiveOld;
    log.pagesProcessed = 1;

    if (consecutiveOld >= SKIP_THRESHOLD) {
      earlyStop = true;
      console.log(`\n⏹️  Early-stop! Gặp ${consecutiveOld} bản cũ liên tiếp → không có data mới`);
    }

    currentPage++;

    // Process remaining pages
    while (currentPage <= totalPages && !earlyStop) {
      await delay(config.crawl.delayMs);

      try {
        const res = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize });
        if (res && res.items) {
          const pageResult = await processItems(res.items, stats, consecutiveOld);
          consecutiveOld = pageResult.consecutiveOld;

          if (consecutiveOld >= SKIP_THRESHOLD) {
            earlyStop = true;
            console.log(`\n⏹️  Early-stop tại trang ${currentPage}! Gặp ${consecutiveOld} bản cũ liên tiếp`);
          }
        }
      } catch (err) {
        console.error(`  ❌ Lỗi trang ${currentPage}: ${err.message}`);
        log.errorMessages.push(`Page ${currentPage}: ${err.message}`);
        stats.errors++;
      }

      log.pagesProcessed = currentPage - startPage + 1;
      log.lastPage = currentPage;

      if (currentPage % 5 === 0 || currentPage === totalPages || earlyStop) {
        console.log(`  📄 Trang ${currentPage}/${totalPages} | +${stats.inserted} mới | ~${stats.updated} cũ | streak=${consecutiveOld}`);
        await log.save();
      }

      currentPage++;
    }

    log.status = earlyStop ? 'early_stopped' : 'completed';
    const reason = earlyStop ? '(early-stop: hết data mới)' : '';
    console.log(`\n✅ Hoàn thành ${reason}! Inserted: ${stats.inserted} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`);
  } catch (err) {
    log.status = 'failed';
    log.errorMessages.push(err.message);
    console.error(`\n❌ Crawl thất bại: ${err.message}`);
  }

  log.finishedAt = new Date();
  log.itemsInserted = stats.inserted;
  log.itemsUpdated = stats.updated;
  log.itemsSkipped = stats.skipped;
  await log.save();

  return stats;
}

/**
 * Xử lý list items - trả về consecutiveOld để caller theo dõi
 * @param {Array} items
 * @param {Object} stats
 * @param {number} prevConsecutiveOld - số bản cũ liên tiếp từ page trước
 * @returns {{ consecutiveOld: number }}
 */
async function processItems(items, stats, prevConsecutiveOld = 0) {
  let consecutiveOld = prevConsecutiveOld;

  for (const item of items) {
    try {
      const sourceId = item.id;
      if (!sourceId) { stats.skipped++; continue; }

      // Check xem đã tồn tại chưa
      const existing = await AuctionNotice.findOne({ sourceId });

      if (existing) {
        // Bản ghi cũ → tăng bộ đếm
        consecutiveOld++;
        stats.updated++;

        // Kiểm tra early-stop
        if (consecutiveOld >= SKIP_THRESHOLD) {
          return { consecutiveOld };
        }
      } else {
        // Bản ghi MỚI → lưu vào DB, reset bộ đếm
        const data = buildAuctionData(item);
        data.sourceId = sourceId;
        data.lastCrawledAt = new Date();
        
        // Find or create sample based on name
        if (data.name) {
          const sample = await AuctionSample.findOneAndUpdate(
            { name: data.name },
            { $setOnInsert: { name: data.name } },
            { upsert: true, new: true }
          );
          data.sampleId = sample._id;
        }

        await AuctionNotice.create(data);
        stats.inserted++;
        consecutiveOld = 0; // Reset vì tìm thấy data mới
      }
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key → bản cũ
        consecutiveOld++;
        stats.skipped++;
      } else {
        stats.errors++;
        consecutiveOld = 0; // Lỗi khác, reset
        console.error(`  ⚠️ Lỗi item ${item.id}: ${err.message}`);
      }
    }
  }

  return { consecutiveOld };
}

/**
 * Build auction data object từ API response item
 */
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
  const status = deriveStatus(registrationEnd, auctionDate);

  const sourceUrl = `${BASE}${config.endpoints.auctionDetailBase}/${slug}-${item.id}.html`;

  return {
    name,
    shortDescription,
    titleName: item.titleName || '',
    slug,
    type,
    province,
    propertyTypeId: item.propertyTypeId,
    propertyTypeName,
    publishedAt,
    auctionDate,
    registrationStart,
    registrationEnd,
    organizer: item.org_name || '',
    owner: item.fullname || '',
    sourceUrl,
    status,
  };
}

module.exports = { crawlAuctionNotices };
