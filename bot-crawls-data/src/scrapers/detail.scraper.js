/**
 * Detail helpers: lấy chi tiết + lịch sử đăng + tạo Duplicate
 * 
 * Logic phát hiện bài đăng lại:
 *   1. API pageAuctionInfoPublish2 → trả rootID + relatedIds (chính xác nhất)
 *   2. API search/auction-notice?nameAsset=X → tìm cùng tên tài sản
 *   3. DB aggregate → nhóm theo tên giống nhau
 * 
 * Kết quả: Bảng Duplicate lưu nhóm bài đăng lại + so sánh giá
 */
const config = require('../config');
const { fetchAPI } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');
const CrawlLog = require('../models/CrawlLog');
const { delay, slugify } = require('../utils/helpers');

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

// ═══════════════════════════════════════════════════════
// DUPLICATE HANDLING (CỐT LÕI - PHÁT HIỆN BÀI ĐĂNG LẠI)
// ═══════════════════════════════════════════════════════

/**
 * Tạo/update Duplicate record khi phát hiện bài đăng lại.
 * 
 * Logic:
 *   1. Merge tất cả sourceIds vào 1 nhóm
 *   2. Tra cứu giá từng bài trong DB
 *   3. Tính toán giảm giá (so sánh lần đầu vs lần cuối)
 *   4. Lưu entries chi tiết cho từng lần đăng
 */
async function handleDuplicate(sourceId, name, relatedIds, type = 'auction') {
  if (!relatedIds || relatedIds.length === 0) return;

  const allIds = [...new Set([sourceId, ...relatedIds])].sort((a, b) => a - b);

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
  } else {
    dup = new Duplicate({ name, sourceIds: allIds, type });
  }

  // Nạp chi tiết giá + ngày từ DB cho tất cả sourceIds
  const entries = await buildDuplicateEntries(dup.sourceIds, type);
  dup.entries = entries;
  dup.relistCount = entries.length;

  // Tính toán giá - phát hiện giảm giá ở BẤT KỲ lần đăng nào
  if (entries.length > 0) {
    const pricesWithValues = entries.filter(e => e.price && e.price > 0);
    if (pricesWithValues.length > 0) {
      dup.firstPrice = pricesWithValues[0].price;
      dup.latestPrice = pricesWithValues[pricesWithValues.length - 1].price;

      // Tìm giá thấp nhất trong tất cả các lần đăng
      const minPrice = Math.min(...pricesWithValues.map(e => e.price));
      const maxPrice = Math.max(...pricesWithValues.map(e => e.price));

      // isPriceDrop = true nếu BẤT KỲ lần nào có giá thấp hơn lần đầu
      // Ví dụ: 52M → 41M → 41M → 52M → vẫn là price drop
      const hasAnyDrop = pricesWithValues.some(e => e.price < dup.firstPrice);
      const uniquePrices = [...new Set(pricesWithValues.map(e => e.price))];

      if (hasAnyDrop || uniquePrices.length > 1) {
        dup.isPriceDrop = true;
        // % giảm giá tính theo giá nhỏ nhất so với giá đầu tiên
        dup.priceDropPercent = Math.round((1 - minPrice / dup.firstPrice) * 10000) / 100;
      } else {
        dup.isPriceDrop = false;
        dup.priceDropPercent = 0;
      }
    }

    // Lấy rootId từ entry đầu tiên có rootId
    const entryWithRoot = entries.find(e => e.rootId);
    if (entryWithRoot) dup.rootId = entryWithRoot.rootId;
  }

  await dup.save();
}

/**
 * Build entries chi tiết từ DB cho 1 nhóm sourceIds
 */
async function buildDuplicateEntries(sourceIds, type) {
  const Model = type === 'org' ? OrgSelection : AuctionNotice;
  const priceField = type === 'org' ? 'startingPrice' : 'initialPrice';

  const items = await Model.find({ sourceId: { $in: sourceIds } })
    .select(`sourceId ${priceField} publishedAt publishRound publishRoundLabel rootId sourceUrl`)
    .sort({ sourceId: 1 })
    .lean();

  // Map lại thành entries
  const entries = items.map((item, idx) => ({
    sourceId: item.sourceId,
    price: item[priceField] || item.currentPrice || 0,
    publishedAt: item.publishedAt,
    publishRound: item.publishRound || idx + 1,
    publishRoundLabel: item.publishRoundLabel || '',
    rootId: item.rootId || null,
    sourceUrl: item.sourceUrl || '',
  }));

  // Thêm placeholder cho sourceIds chưa có trong DB
  const foundIds = items.map(i => i.sourceId);
  const missingIds = sourceIds.filter(id => !foundIds.includes(id));
  for (const id of missingIds) {
    entries.push({
      sourceId: id,
      price: 0,
      publishedAt: null,
      publishRound: 0,
      publishRoundLabel: '',
      rootId: null,
      sourceUrl: '',
    });
  }

  // Sắp xếp theo sourceId (id nhỏ = đăng trước)
  entries.sort((a, b) => a.sourceId - b.sourceId);

  return entries;
}

/**
 * Tìm các ID trùng lặp bằng cách gọi API search với nameAsset chính xác.
 * ⚠️ API List dùng param `nameAsset` (KHÔNG phải `assetName`)
 */
async function searchDuplicatesByExactName(sourceId, name, type) {
  let relatedIds = [];
  try {
    if (!name || name.trim().length === 0) return [];

    let endpoint = '';
    let payload = { numberPerPage: 20, p: 1, typeOrder: 2 };
    
    if (type === 'auction') {
      endpoint = '/portal/search/auction-notice';
      payload.nameAsset = name.trim();
    } else {
      endpoint = '/ThongTin/getInfoSelectAuctionOrg';
      payload.nameAsset = name.trim();
    }
    
    const res = await fetchAPI(endpoint, payload);
    
    // Nếu API trả về > 1 item và rowCount hợp lý (tránh trường hợp API lờ đi filter và trả về toàn bộ DB >1000)
    if (res && res.items && res.items.length >= 2 && res.rowCount < 100) {
      relatedIds = res.items.map(i => i.id).filter(id => id !== sourceId && id !== undefined && id !== null);
    }
  } catch (err) {
    // ignore
  }
  return relatedIds;
}

// ═══════════════════════════════════════════════════════
// HELPER: Chi tiết THÔNG BÁO ĐẤU GIÁ
// ═══════════════════════════════════════════════════════

async function fetchAuctionItemDetail(sourceId) {
  const updates = {};
  let files = [];

  // 1. propertyInfo → giá, địa chỉ, danh sách tài sản
  try {
    const json = await fetchAPI('/portal/propertyInfo', { auctionInfoId: sourceId });
    if (json && json.items && json.items.length > 0) {
      const allItems = json.items;
      const prop = allItems[0]; // Lấy thông tin chung từ item đầu
      if (prop.propertyPlace) updates.address = prop.propertyPlace;
      if (prop.fileCost) updates.applicationFee = prop.fileCost;
      if (prop.propertyAmount) updates.propertyAmount = prop.propertyAmount;
      if (prop.propertyQuality) updates.quality = prop.propertyQuality;

      if (allItems.length === 1) {
        // Bài đăng 1 tài sản → lưu giá bình thường
        if (prop.propertyStartPrice) {
          updates.initialPrice = prop.propertyStartPrice;
          updates.currentPrice = prop.propertyStartPrice;
        }
        if (prop.deposit) updates.deposit = prop.deposit;
      } else {
        // Bài đăng NHIỀU tài sản → lưu chi tiết từng item + tổng giá
        const properties = allItems.map(p => ({
          name: p.propertyName || p.propertyDesc || '',
          amount: p.propertyAmount || '01',
          startPrice: p.propertyStartPrice || 0,
          deposit: p.deposit || 0,
          place: p.propertyPlace || '',
          quality: p.propertyQuality || '',
        }));
        updates.properties = properties;
        // Tổng giá = sum tất cả tài sản
        const totalPrice = properties.reduce((s, p) => s + (p.startPrice || 0), 0);
        const totalDeposit = properties.reduce((s, p) => s + (p.deposit || 0), 0);
        updates.initialPrice = totalPrice;
        updates.currentPrice = totalPrice;
        updates.deposit = totalDeposit;
      }
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
  try {
    const publishInfo = await fetchPublishHistory(sourceId);
    Object.assign(updates, publishInfo);
  } catch (e) {}

  return { updates, files };
}

// ═══════════════════════════════════════════════════════
// HELPER: Chi tiết LỰA CHỌN TỔ CHỨC
// ═══════════════════════════════════════════════════════

async function fetchOrgItemDetail(sourceId) {
  const updates = {};
  let files = [];

  // 1. propertyInfo → giá, địa chỉ, danh sách tài sản
  try {
    const json = await fetchAPI('/portal/propertyInfo', { auctionInfoId: sourceId });
    if (json && json.items && json.items.length > 0) {
      const allItems = json.items;
      const prop = allItems[0];
      if (prop.propertyPlace) updates.address = prop.propertyPlace;
      if (prop.propertyQuality) updates.propertyTypeName = prop.propertyQuality;

      if (allItems.length === 1) {
        if (prop.propertyStartPrice) updates.startingPrice = prop.propertyStartPrice;
      } else {
        const properties = allItems.map(p => ({
          name: p.propertyName || p.propertyDesc || '',
          amount: p.propertyAmount || '01',
          startPrice: p.propertyStartPrice || 0,
          deposit: p.deposit || 0,
          place: p.propertyPlace || '',
          quality: p.propertyQuality || '',
        }));
        updates.properties = properties;
        updates.startingPrice = properties.reduce((s, p) => s + (p.startPrice || 0), 0);
      }
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
  let stats = { updated: 0, skipped: 0, errors: 0 };
  // Lấy N bài mới nhất, rồi lọc bỏ bài đã cào
  const allRecent = await AuctionNotice.find()
    .sort({ publishedAt: -1 }).limit(maxItems);
  const items = allRecent.filter(i => i.detailScraped !== true);
  stats.skipped = allRecent.length - items.length;
  console.log(`[Detail Auction] ${allRecent.length} bài mới nhất → ${items.length} chưa cào, ${stats.skipped} đã bỏ qua`);

  // Xử lý song song bằng chunks
  const concurrency = config.crawl.concurrency || 3;
  const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  const chunks = chunkArray(items, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(async (item) => {
      try {
        await delay(Math.random() * 500); // Thêm xíu delay random để tránh spam quá nhanh
        const { updates, files } = await fetchAuctionItemDetail(item.sourceId);
        const exactNameRelatedIds = await searchDuplicatesByExactName(item.sourceId, item.name, 'auction');
        return { item, updates, files, exactNameRelatedIds, success: true };
      } catch (err) {
        return { item, success: false, err };
      }
    }));

    // Lưu vào DB tuần tự để tránh race condition
    for (const result of chunkResults) {
      if (result.success) {
        const { item, updates, files, exactNameRelatedIds } = result;
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;
        
        await AuctionNotice.updateOne({ _id: item._id }, { $set: updates });
        
        let allRelatedIds = updates.relatedIds || [];
        allRelatedIds = [...new Set([...allRelatedIds, ...exactNameRelatedIds])];

        if (allRelatedIds.length > 0) {
          await handleDuplicate(item.sourceId, item.name, allRelatedIds, 'auction');
        }
        stats.updated++;
      } else {
        stats.errors++;
        await AuctionNotice.updateOne({ _id: result.item._id }, { $set: { detailScraped: true } });
      }
    }
  }
  log.status = 'completed'; log.finishedAt = new Date();
  log.itemsUpdated = stats.updated; log.itemsSkipped = stats.skipped; log.pagesProcessed = allRecent.length;
  await log.save();
  return stats;
}

async function crawlOrgDetails(options = {}) {
  const maxItems = options.maxItems || 50;
  const log = await CrawlLog.create({
    type: 'org_detail', startedAt: new Date(),
    itemsUpdated: 0, itemsSkipped: 0, pagesProcessed: 0, errorMessages: [],
  });
  let stats = { updated: 0, skipped: 0, errors: 0 };
  // Lấy N bài mới nhất, rồi lọc bỏ bài đã cào
  const allRecent = await OrgSelection.find()
    .sort({ publishedAt: -1 }).limit(maxItems);
  const items = allRecent.filter(i => i.detailScraped !== true);
  stats.skipped = allRecent.length - items.length;
  console.log(`[Detail Org] ${allRecent.length} bài mới nhất → ${items.length} chưa cào, ${stats.skipped} đã bỏ qua`);

  // Xử lý song song bằng chunks
  const concurrency = config.crawl.concurrency || 3;
  const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  const chunks = chunkArray(items, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(async (item) => {
      try {
        await delay(Math.random() * 500);
        const { updates, files } = await fetchOrgItemDetail(item.sourceId);
        const exactNameRelatedIds = await searchDuplicatesByExactName(item.sourceId, item.name, 'org');
        return { item, updates, files, exactNameRelatedIds, success: true };
      } catch (err) {
        return { item, success: false, err };
      }
    }));

    for (const result of chunkResults) {
      if (result.success) {
        const { item, updates, files, exactNameRelatedIds } = result;
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;
        
        await OrgSelection.updateOne({ _id: item._id }, { $set: updates });
        
        let allRelatedIds = updates.relatedIds || [];
        allRelatedIds = [...new Set([...allRelatedIds, ...exactNameRelatedIds])];

        if (allRelatedIds.length > 0) {
          await handleDuplicate(item.sourceId, item.name, allRelatedIds, 'org');
        }
        
        stats.updated++;
      } else {
        stats.errors++;
        await OrgSelection.updateOne({ _id: result.item._id }, { $set: { detailScraped: true } });
      }
    }
  }
  log.status = 'completed'; log.finishedAt = new Date();
  log.itemsUpdated = stats.updated; log.itemsSkipped = stats.skipped; log.pagesProcessed = allRecent.length;
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
        let publishRound = 1;
        let publishRoundLabel = '';
        let rootId = null;
        if (pubHistory && Array.isArray(pubHistory.items)) {
          const entry = pubHistory.items.find(i => i.auctionInfoId === missingId);
          if (entry) {
            if (entry.publishTime1) {
              publishedAt = new Date(entry.publishTime1);
            }
            publishRoundLabel = entry.strLevelCorrection || '';
            rootId = entry.rootID || null;
            const match = publishRoundLabel.match(/lần\s+(\d+)/i);
            if (match) publishRound = parseInt(match[1]);
          }
        }
        
        const slug = slugify(name);
        let url = '';
        if (dup.type === 'org') {
          url = `https://dgts.moj.gov.vn/thong-bao-lua-chon-to-chuc-dau-gia/${slug}-${missingId}.html`;
        } else {
          url = `https://dgts.moj.gov.vn/thong-bao-cong-khai-viec-dau-gia/${slug}-${missingId}.html`;
        }

        const newData = {
          sourceId: missingId,
          name,
          address,
          publishedAt,
          publishRound,
          publishRoundLabel,
          rootId,
          sourceUrl: url,
          status: 'unknown',
          detailScraped: false,
        };
        
        if (dup.type === 'org') {
          newData.startingPrice = initialPrice;
        } else {
          newData.initialPrice = initialPrice;
          newData.currentPrice = initialPrice;
        }

        await Model.updateOne({ sourceId: missingId }, { $set: newData }, { upsert: true });
        recoveredCount++;
        
      } catch (err) {
        console.error(`Lỗi phục hồi ID ${missingId}:`, err.message);
      }
    }

    // Sau khi recover xong, rebuild entries cho dup này
    await handleDuplicate(dup.sourceIds[0], dup.name, dup.sourceIds.slice(1), dup.type);
  }
  
  console.log(`✅ Hoàn thành phục hồi ${recoveredCount} bài đăng bị thiếu.`);
  return recoveredCount;
}

// ═══════════════════════════════════════════════════════
// REBUILD ALL DUPLICATE ENTRIES (chạy 1 lần để fix data cũ)
// ═══════════════════════════════════════════════════════

/**
 * Rebuild entries + price info cho tất cả Duplicate records hiện có.
 * Dùng khi:
 *   - Vừa upgrade schema Duplicate (thêm entries, firstPrice, latestPrice...)
 *   - Muốn cập nhật lại giá cho tất cả nhóm
 */
async function rebuildAllDuplicateEntries() {
  console.log(`\n🔄 [Duplicate] Rebuild entries cho tất cả nhóm...`);
  const duplicates = await Duplicate.find({});
  let updatedCount = 0;

  for (const dup of duplicates) {
    if (!dup.sourceIds || dup.sourceIds.length === 0) continue;

    const entries = await buildDuplicateEntries(dup.sourceIds, dup.type);
    dup.entries = entries;
    dup.relistCount = entries.length;

    const pricesWithValues = entries.filter(e => e.price && e.price > 0);
    if (pricesWithValues.length > 0) {
      dup.firstPrice = pricesWithValues[0].price;
      dup.latestPrice = pricesWithValues[pricesWithValues.length - 1].price;

      const minPrice = Math.min(...pricesWithValues.map(e => e.price));
      const hasAnyDrop = pricesWithValues.some(e => e.price < dup.firstPrice);
      const uniquePrices = [...new Set(pricesWithValues.map(e => e.price))];

      if (hasAnyDrop || uniquePrices.length > 1) {
        dup.isPriceDrop = true;
        dup.priceDropPercent = Math.round((1 - minPrice / dup.firstPrice) * 10000) / 100;
      } else {
        dup.isPriceDrop = false;
        dup.priceDropPercent = 0;
      }
    }

    const entryWithRoot = entries.find(e => e.rootId);
    if (entryWithRoot) dup.rootId = entryWithRoot.rootId;

    await dup.save();
    updatedCount++;

    if (updatedCount % 100 === 0) {
      console.log(`  ✅ ${updatedCount}/${duplicates.length} nhóm`);
    }
  }

  console.log(`✅ Rebuild hoàn thành: ${updatedCount} nhóm.`);
  return updatedCount;
}

module.exports = {
  fetchAuctionItemDetail,
  fetchOrgItemDetail,
  fetchPublishHistory,
  handleDuplicate,
  searchDuplicatesByExactName,
  buildDuplicateEntries,
  crawlDetails,
  crawlOrgDetails,
  recoverMissingDuplicates,
  rebuildAllDuplicateEntries,
};
