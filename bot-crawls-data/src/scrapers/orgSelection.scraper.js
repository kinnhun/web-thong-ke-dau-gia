const config = require('../config');
const { fetchAPI } = require('../browser');
const OrgSelection = require('../models/OrgSelection');
const AuctionSample = require('../models/AuctionSample');
const CrawlLog = require('../models/CrawlLog');
const { slugify, parseDate, extractProvince, delay } = require('../utils/helpers');

const BASE = config.baseUrl;
const API = config.endpoints.orgSelectionList;
const SKIP_THRESHOLD = config.crawl.skipThreshold;

/**
 * Cào danh sách thông báo lựa chọn tổ chức đấu giá
 * 
 * Logic early-stop: dừng khi gặp 20 bản cũ liên tiếp
 */
async function crawlOrgSelections(options = {}) {
  const pageSize = options.pageSize || config.crawl.pageSize;
  const startPage = options.startPage || 1;
  const maxPages = options.maxPages || config.crawl.maxPages;

  const log = await CrawlLog.create({
    type: 'org_selection',
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
  let consecutiveOld = 0;
  let earlyStop = false;

  console.log(`\n🚀 Bắt đầu cào Thông báo lựa chọn tổ chức từ trang ${startPage}...`);
  console.log(`   ⚡ Early-stop: dừng khi gặp ${SKIP_THRESHOLD} bản cũ liên tiếp`);

  try {
    const firstRes = await fetchAPI(API, { p: currentPage, numberPerPage: pageSize });
    if (!firstRes || !firstRes.items) throw new Error('Không thể fetch trang đầu tiên');

    totalPages = firstRes.pageCount || 1;
    const totalItems = firstRes.rowCount || 0;
    if (maxPages > 0) totalPages = Math.min(totalPages, maxPages + startPage - 1);

    console.log(`📊 Tổng trên server: ${totalItems} items, ${totalPages} pages`);
    log.totalPages = totalPages;

    const firstResult = await processItems(firstRes.items, stats);
    consecutiveOld = firstResult.consecutiveOld;
    log.pagesProcessed = 1;

    if (consecutiveOld >= SKIP_THRESHOLD) {
      earlyStop = true;
      console.log(`\n⏹️  Early-stop! Gặp ${consecutiveOld} bản cũ liên tiếp → không có data mới`);
    }

    currentPage++;

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
    console.log(`\n✅ Hoàn thành ${reason}! Inserted: ${stats.inserted} | Updated: ${stats.updated} | Skipped: ${stats.skipped}`);
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

async function processItems(items, stats, prevConsecutiveOld = 0) {
  let consecutiveOld = prevConsecutiveOld;

  for (const item of items) {
    try {
      const sourceId = item.id;
      if (!sourceId) { stats.skipped++; continue; }

      const existing = await OrgSelection.findOne({ sourceId });

      if (existing) {
        consecutiveOld++;
        stats.updated++;
        if (consecutiveOld >= SKIP_THRESHOLD) {
          return { consecutiveOld };
        }
      } else {
        const data = buildOrgData(item);
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

        await OrgSelection.create(data);
        stats.inserted++;
        consecutiveOld = 0;
      }
    } catch (err) {
      if (err.code === 11000) {
        consecutiveOld++;
        stats.skipped++;
      } else {
        stats.errors++;
        consecutiveOld = 0;
        console.error(`  ⚠️ Lỗi item ${item.id}: ${err.message}`);
      }
    }
  }

  return { consecutiveOld };
}

function buildOrgData(item) {
  const name = item.propertyName || '';
  const shortDescription = item.subPropertyName || '';
  const slug = slugify(shortDescription || name);
  const province = extractProvince(name + ' ' + shortDescription);

  return {
    name,
    shortDescription,
    slug,
    owner: item.fullname || '',
    publishedAt: parseDate(item.lastUpdated),
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
