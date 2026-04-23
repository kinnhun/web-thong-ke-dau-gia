/**
 * Detail helpers: lấy chi tiết + lịch sử đăng + tạo Duplicate
 */
const config = require('../config');
const { fetchAPI } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');
const CrawlLog = require('../models/CrawlLog');
const { delay } = require('../utils/helpers');

// ═══════════════════════════════════════════════════════
// HELPER: Lịch sử đăng (đăng lần mấy?)
// API: /portal/pageAuctionInfoPublish2?auctionInfoId=X&p=0
// ═══════════════════════════════════════════════════════

/**
 * Gọi API pageAuctionInfoPublish2 để biết item đăng lần thứ mấy.
 * Response trả về mảng các lần đăng.
 * 
 * @param {number} sourceId
 * @returns {{ publishRound, publishRoundLabel, rootId, relatedIds }}
 */
async function fetchPublishHistory(sourceId) {
  const result = {
    publishRound: 1,
    publishRoundLabel: 'Thông báo công khai lần 1',
    rootId: null,
    relatedIds: [],
  };

  try {
    const data = await fetchAPI('/portal/pageAuctionInfoPublish2', {
      auctionInfoId: sourceId,
      p: 0,
    });

    const items = data && Array.isArray(data.items) ? data.items : [];

    if (items.length > 0) {
      // Tìm entry của chính sourceId này
      const selfEntry = items.find(d => d.auctionInfoId === sourceId);
      if (selfEntry) {
        result.publishRoundLabel = selfEntry.strLevelCorrection || '';
        result.rootId = selfEntry.rootID || null;

        // Parse số lần từ label: "Thông báo công khai lần 2" → 2
        const match = result.publishRoundLabel.match(/lần\s+(\d+)/i);
        if (match) result.publishRound = parseInt(match[1]);
      }

      // Thu thập tất cả IDs liên quan
      result.relatedIds = items.map(d => d.auctionInfoId).filter(id => id !== sourceId);
    }
  } catch (e) {
    // Không throw, giữ default
  }

  return result;
}

/**
 * Tạo/update Duplicate record nếu có nhiều hơn 1 lần đăng
 */
async function handleDuplicate(sourceId, name, relatedIds, type = 'auction') {
  if (!relatedIds || relatedIds.length === 0) return;

  const allIds = [sourceId, ...relatedIds].sort((a, b) => a - b);

  // Tìm duplicate đã có chứa bất kỳ ID nào
  let dup = await Duplicate.findOne({
    sourceIds: { $in: allIds },
    type,
  });

  if (dup) {
    // Merge thêm IDs mới
    const merged = [...new Set([...dup.sourceIds, ...allIds])].sort((a, b) => a - b);
    dup.sourceIds = merged;
    dup.name = name || dup.name;
    await dup.save();
  } else {
    await Duplicate.create({ name, sourceIds: allIds, type });
  }
}

// ═══════════════════════════════════════════════════════
// HELPER: Chi tiết THÔNG BÁO ĐẤU GIÁ
// ═══════════════════════════════════════════════════════

async function fetchAuctionItemDetail(sourceId) {
  const updates = {};
  let files = [];

  // 1. propertyInfo → giá, địa chỉ
  try {
    const json = await fetchAPI('/portal/propertyInfo', { auctionInfoId: sourceId });
    if (json && json.items && json.items.length > 0) {
      const prop = json.items[0];
      if (prop.propertyPlace) updates.address = prop.propertyPlace;
      if (prop.propertyStartPrice) {
        updates.initialPrice = prop.propertyStartPrice;
        updates.currentPrice = prop.propertyStartPrice;
      }
      if (prop.deposit) updates.deposit = prop.deposit;
      if (prop.fileCost) updates.applicationFee = prop.fileCost;
      if (prop.propertyAmount) updates.propertyAmount = prop.propertyAmount;
      if (prop.propertyQuality) updates.quality = prop.propertyQuality;
    }
  } catch (e) {}

  // 2. viewDetailAuctionInfo → files
  try {
    const viewDetail = await fetchAPI('/portal/viewDetailAuctionInfo', { auctionInfoId: sourceId });
    if (viewDetail && Array.isArray(viewDetail.listFile) && viewDetail.listFile.length > 0) {
      files = viewDetail.listFile
        .filter(f => f.linkFile)
        .map(f => ({
          name: f.fileName,
          url: `https://dgts.moj.gov.vn/portal/downloadFile?linkFile=${encodeURIComponent(f.linkFile)}`
        }));
    }
  } catch (e) {}

  // 3. pageAuctionInfoPublish2 → đăng lần mấy
  const publishInfo = await fetchPublishHistory(sourceId);
  Object.assign(updates, publishInfo);

  return { updates, files };
}

// ═══════════════════════════════════════════════════════
// HELPER: Chi tiết LỰA CHỌN TỔ CHỨC
// ═══════════════════════════════════════════════════════

async function fetchOrgItemDetail(sourceId) {
  const updates = {};
  let files = [];

  // 1. propertyInfo → giá, địa chỉ
  try {
    const json = await fetchAPI('/portal/propertyInfo', { auctionInfoId: sourceId });
    if (json && json.items && json.items.length > 0) {
      const prop = json.items[0];
      if (prop.propertyPlace) updates.address = prop.propertyPlace;
      if (prop.propertyStartPrice) updates.startingPrice = prop.propertyStartPrice;
      if (prop.propertyQuality) updates.propertyTypeName = prop.propertyQuality;
    }
  } catch (e) {}

  // 2. getInfoEditNotice → files
  try {
    const editNotice = await fetchAPI('/ThongTin/getInfoEditNotice', { id: sourceId });
    if (editNotice) {
      if (Array.isArray(editNotice.listFileNotice)) {
        editNotice.listFileNotice.forEach(f => {
          if (f.linkFile) {
            files.push({
              name: f.fileName,
              url: `https://dgts.moj.gov.vn/ThongTin/downloadFile?linkFile=${encodeURIComponent(f.linkFile)}`
            });
          }
        });
      }
      if (Array.isArray(editNotice.property)) {
        editNotice.property.forEach(p => {
          if (Array.isArray(p.listFile)) {
            p.listFile.forEach(f => {
              if (f.linkFile) {
                files.push({
                  name: f.fileName,
                  url: `https://dgts.moj.gov.vn/ThongTin/downloadFile?linkFile=${encodeURIComponent(f.linkFile)}`
                });
              }
            });
          }
          if (p.propertyName && !updates.assetDescription) {
            updates.assetDescription = p.propertyName;
          }
        });
      }
      if (editNotice.notice && editNotice.notice.content) {
        updates.requirements = editNotice.notice.content.substring(0, 2000);
      }
    }
  } catch (e) {}

  // 3. pageAuctionInfoPublish2 → đăng lần mấy
  try {
    const publishInfo = await fetchPublishHistory(sourceId);
    Object.assign(updates, publishInfo);
  } catch (e) {}

  return { updates, files };
}

// ═══════════════════════════════════════════════════════
// MANUAL RE-CRAWL
// ═══════════════════════════════════════════════════════

async function crawlDetails(options = {}) {
  const maxItems = options.maxItems || 100;
  const log = await CrawlLog.create({
    type: 'detail', startedAt: new Date(),
    itemsUpdated: 0, itemsSkipped: 0, pagesProcessed: 0, errorMessages: [],
  });
  let stats = { updated: 0, errors: 0 };
  const items = await AuctionNotice.find({ detailScraped: { $ne: true } })
    .sort({ publishedAt: -1 }).limit(maxItems);

  for (const item of items) {
    try {
      await delay(config.crawl.delayMs);
      const { updates, files } = await fetchAuctionItemDetail(item.sourceId);
      updates.detailScraped = true;
      updates.lastCrawledAt = new Date();
      if (files.length > 0) updates.files = files;
      await AuctionNotice.updateOne({ _id: item._id }, { $set: updates });
      // Handle duplicate
      if (updates.relatedIds && updates.relatedIds.length > 0) {
        await handleDuplicate(item.sourceId, item.name, updates.relatedIds, 'auction');
      }
      stats.updated++;
    } catch (err) {
      stats.errors++;
      await AuctionNotice.updateOne({ _id: item._id }, { $set: { detailScraped: true } });
    }
  }
  log.status = 'completed'; log.finishedAt = new Date();
  log.itemsUpdated = stats.updated; log.pagesProcessed = items.length;
  await log.save();
  return stats;
}

async function crawlOrgDetails(options = {}) {
  const maxItems = options.maxItems || 50;
  const log = await CrawlLog.create({
    type: 'org_detail', startedAt: new Date(),
    itemsUpdated: 0, itemsSkipped: 0, pagesProcessed: 0, errorMessages: [],
  });
  let stats = { updated: 0, errors: 0 };
  const items = await OrgSelection.find({ detailScraped: { $ne: true } })
    .sort({ publishedAt: -1 }).limit(maxItems);

    for (const item of items) {
      try {
        await delay(config.crawl.delayMs);
        const { updates, files } = await fetchOrgItemDetail(item.sourceId);
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files.length > 0) updates.files = files;
        await OrgSelection.updateOne({ _id: item._id }, { $set: updates });
        
        // Handle duplicate
        if (updates.relatedIds && updates.relatedIds.length > 0) {
          await handleDuplicate(item.sourceId, item.name, updates.relatedIds, 'org');
        }
        
        stats.updated++;
      } catch (err) {
      stats.errors++;
      await OrgSelection.updateOne({ _id: item._id }, { $set: { detailScraped: true } });
    }
  }
  log.status = 'completed'; log.finishedAt = new Date();
  log.itemsUpdated = stats.updated; log.pagesProcessed = items.length;
  await log.save();
  return stats;
}

// ═══════════════════════════════════════════════════════
// RECOVER MISSING DUPLICATES
// ═══════════════════════════════════════════════════════

async function recoverMissingDuplicates() {
  console.log(`\n🔍 [Duplicate] Bắt đầu cào phục hồi các bài đăng bị thiếu...`);
  const duplicates = await Duplicate.find({});
  let recoveredCount = 0;

  for (const dup of duplicates) {
    if (!dup.sourceIds || dup.sourceIds.length === 0) continue;
    
    const Model = dup.type === 'org' ? OrgSelection : AuctionNotice;
    const existingItems = await Model.find({ sourceId: { $in: dup.sourceIds } }).select('sourceId');
    const existingIds = existingItems.map(i => i.sourceId);
    
    const missingIds = dup.sourceIds.filter(id => !existingIds.includes(id));
    if (missingIds.length === 0) continue;

    for (const missingId of missingIds) {
      console.log(`Đang cào phục hồi ID ${missingId} (${dup.type})...`);
      try {
        await delay(config.crawl.delayMs || 1000);
        const propInfo = await fetchAPI('/portal/propertyInfo', { auctionInfoId: missingId });
        const pubHistory = await fetchAPI('/portal/pageAuctionInfoPublish2', { auctionInfoId: missingId, p: 0 });
        
        let name = null, initialPrice = null, address = null;
        if (propInfo && propInfo.items && propInfo.items.length > 0) {
          name = propInfo.items[0].propertyName || propInfo.items[0].propertyDesc || `Bài đăng ${missingId}`;
          initialPrice = propInfo.items[0].propertyStartPrice;
          address = propInfo.items[0].propertyPlace;
        } else {
          name = `Bài đăng ${missingId} (Không có dữ liệu chi tiết)`;
        }
        
        let publishedAt = new Date();
        if (pubHistory && Array.isArray(pubHistory.items)) {
          const entry = pubHistory.items.find(i => i.auctionInfoId === missingId);
          if (entry && entry.publishTime1) {
            publishedAt = new Date(entry.publishTime1);
          }
        }
        
        let url = '';
        if (dup.type === 'org') {
          url = `https://dgts.moj.gov.vn/thong-bao-lua-chon-to-chuc-dau-gia/${missingId}.html`;
        } else {
          url = `https://dgts.moj.gov.vn/thong-bao-cong-khai-viec-dau-gia/${missingId}.html`;
        }

        const newData = {
          sourceId: missingId,
          name,
          address,
          publishedAt,
          sourceUrl: url,
          status: 'Đã phục hồi',
          detailScraped: false
        };
        
        if (dup.type === 'org') {
          newData.startingPrice = initialPrice;
        } else {
          newData.initialPrice = initialPrice;
        }

        await Model.updateOne({ sourceId: missingId }, { $set: newData }, { upsert: true });
        
        // Cào thêm files và details
        if (dup.type === 'org') {
           await fetchOrgItemDetail(missingId); // updates are skipped here but files might be triggered next detail crawl
        } else {
           await fetchAuctionItemDetail(missingId);
        }
        
        recoveredCount++;
        
      } catch (err) {
        console.error(`Lỗi phục hồi ID ${missingId}:`, err.message);
      }
    }
  }
  
  console.log(`✅ Hoàn thành phục hồi ${recoveredCount} bài đăng bị thiếu.`);
  return recoveredCount;
}

module.exports = {
  fetchAuctionItemDetail,
  fetchOrgItemDetail,
  fetchPublishHistory,
  handleDuplicate,
  crawlDetails,
  crawlOrgDetails,
  recoverMissingDuplicates
};
