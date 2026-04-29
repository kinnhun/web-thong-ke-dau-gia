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

const duplicateScanState = {
  isRunning: false,
  cancelRequested: false,
};

function requestDuplicateScanCancel() {
  if (!duplicateScanState.isRunning) {
    return false;
  }
  duplicateScanState.cancelRequested = true;
  return true;
}

function resetDuplicateScanState() {
  duplicateScanState.isRunning = false;
  duplicateScanState.cancelRequested = false;
}

function getDuplicateScanState() {
  return { ...duplicateScanState };
}


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
    // 1. Lấy thông tin Publish2 (Lần 1, lần 2...)
    const dataPublish2 = await fetchAPI('/portal/pageAuctionInfoPublish2', {
      auctionInfoId: sourceId,
      p: 0,
    });
    
    // 2. Lấy thông tin Corrections (Đính chính / Thay đổi)
    const dataCorrections = await fetchAPI('/portal/pageAuctionInfoCorrections', {
      auctionInfoId: sourceId,
      p: 0,
    });

    const itemsPublish2 = dataPublish2 && Array.isArray(dataPublish2.items) ? dataPublish2.items : [];
    const itemsCorrections = dataCorrections && Array.isArray(dataCorrections.items) ? dataCorrections.items : [];
    
    // Tìm self entry trong Publish2 trước, nếu không có thì tìm trong Corrections
    const selfEntry = itemsPublish2.find(d => d.auctionInfoId === sourceId) || itemsCorrections.find(d => d.auctionInfoId === sourceId);
    
    if (selfEntry) {
      result.publishRoundLabel = selfEntry.strLevelCorrection || '';
      result.rootId = selfEntry.rootID || null;

      const match = result.publishRoundLabel.match(/lần\s+(\d+)/i);
      if (match) result.publishRound = parseInt(match[1]);
    }

    // Gộp tất cả IDs liên quan từ cả 2 mảng
    const allIds = [
      ...itemsPublish2.map(d => d.auctionInfoId),
      ...itemsCorrections.map(d => d.auctionInfoId)
    ].filter(id => id && id !== sourceId);

    result.relatedIds = [...new Set(allIds)];
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

  // Tính toán giá — chỉ đánh dấu giảm giá khi latestPrice < firstPrice
  if (entries.length > 0) {
    const pricesWithValues = entries.filter(e => e.price && e.price > 0);
    if (pricesWithValues.length > 0) {
      dup.firstPrice = pricesWithValues[0].price;
      dup.latestPrice = pricesWithValues[pricesWithValues.length - 1].price;

      // isPriceDrop = true CHỈ KHI:
      //   1. Giá lần cuối thấp hơn giá lần đầu
      //   2. Có ít nhất 2 thời điểm đăng khác nhau (loại trường hợp cùng lúc, khác tài sản)
      const uniqueTimestamps = [...new Set(
        pricesWithValues
          .filter(e => e.publishedAt)
          .map(e => new Date(e.publishedAt).getTime())
      )];
      const isActualRelist = uniqueTimestamps.length >= 2;

      if (type === 'auction' && dup.latestPrice < dup.firstPrice && isActualRelist) {
        dup.isPriceDrop = true;
        dup.priceDropPercent = Math.round((1 - dup.latestPrice / dup.firstPrice) * 10000) / 100;
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
  const selectFields = type === 'org'
    ? `sourceId ${priceField} publishedAt publishRound publishRoundLabel rootId sourceUrl`
    : `sourceId ${priceField} currentPrice publishedAt publishRound publishRoundLabel rootId sourceUrl`;

  const items = await Model.find({ sourceId: { $in: sourceIds } })
    .select(selectFields)
    .sort({ publishedAt: 1, sourceId: 1 })
    .lean();

  return buildDuplicateEntriesFromItems(sourceIds, items, type);
}

function buildDuplicateEntriesFromItems(sourceIds, items, type) {
  const priceField = type === 'org' ? 'startingPrice' : 'initialPrice';

  const entries = items.map((item, idx) => ({
    sourceId: item.sourceId,
    price: item[priceField] || item.currentPrice || 0,
    publishedAt: item.publishedAt,
    publishRound: item.publishRound || idx + 1,
    publishRoundLabel: item.publishRoundLabel || '',
    rootId: item.rootId || null,
    sourceUrl: item.sourceUrl || '',
  }));

  const foundIds = new Set(items.map((item) => item.sourceId));
  const missingIds = sourceIds.filter((id) => !foundIds.has(id));

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

  entries.sort((a, b) => {
    const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : Number.MAX_SAFE_INTEGER;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return a.sourceId - b.sourceId;
  });

  return entries;
}

function summarizeDuplicateEntries(entries, type) {
  const pricesWithValues = entries.filter((entry) => entry.price && entry.price > 0);

  let firstPrice = 0;
  let latestPrice = 0;
  let isPriceDrop = false;
  let priceDropPercent = 0;

  if (pricesWithValues.length > 0) {
    firstPrice = pricesWithValues[0].price;
    latestPrice = pricesWithValues[pricesWithValues.length - 1].price;

    const uniqueTimestamps = [...new Set(
      pricesWithValues
        .filter((entry) => entry.publishedAt)
        .map((entry) => new Date(entry.publishedAt).getTime())
    )];

    const isActualRelist = uniqueTimestamps.length >= 2;
    if (type === 'auction' && latestPrice < firstPrice && isActualRelist) {
      isPriceDrop = true;
      priceDropPercent = Math.round((1 - latestPrice / firstPrice) * 10000) / 100;
    }
  }

  const entryWithRoot = entries.find((entry) => entry.rootId);

  return {
    entries,
    relistCount: entries.length,
    firstPrice,
    latestPrice,
    isPriceDrop,
    priceDropPercent,
    rootId: entryWithRoot ? entryWithRoot.rootId : null,
  };
}

function buildGraphGroups(items, getRelatedIds) {
  const adjacency = new Map();

  const ensureNode = (id) => {
    if (!adjacency.has(id)) {
      adjacency.set(id, new Set());
    }
    return adjacency.get(id);
  };

  for (const item of items) {
    if (!item || !item.sourceId) continue;

    const sourceId = item.sourceId;
    const relatedIds = Array.isArray(getRelatedIds(item)) ? getRelatedIds(item) : [];
    const node = ensureNode(sourceId);

    for (const relatedId of relatedIds) {
      if (!relatedId || relatedId === sourceId) continue;
      node.add(relatedId);
      ensureNode(relatedId).add(sourceId);
    }
  }

  const visited = new Set();
  const groups = [];

  for (const sourceId of adjacency.keys()) {
    if (visited.has(sourceId)) continue;

    const stack = [sourceId];
    const group = [];
    visited.add(sourceId);

    while (stack.length > 0) {
      const current = stack.pop();
      group.push(current);

      for (const nextId of adjacency.get(current) || []) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          stack.push(nextId);
        }
      }
    }

    if (group.length >= 2) {
      groups.push(group.sort((a, b) => a - b));
    }
  }

  return groups;
}

function mergeDuplicateGroups(...groupSets) {
  const mergedMap = new Map();

  for (const groups of groupSets) {
    for (const group of groups) {
      if (!Array.isArray(group) || group.length < 2) continue;

      const normalized = [...new Set(group)].sort((a, b) => a - b);
      const key = normalized.join('-');
      if (!mergedMap.has(key)) {
        mergedMap.set(key, normalized);
      }
    }
  }

  return [...mergedMap.values()].sort((a, b) => a[0] - b[0]);
}

async function fetchDuplicateSourceMap(type, sourceIds) {
  const Model = type === 'org' ? OrgSelection : AuctionNotice;
  const priceField = type === 'org' ? 'startingPrice' : 'initialPrice';
  const selectFields = type === 'org'
    ? `sourceId name ${priceField} publishedAt publishRound publishRoundLabel rootId sourceUrl`
    : `sourceId name ${priceField} currentPrice publishedAt publishRound publishRoundLabel rootId sourceUrl`;

  const items = await Model.find({ sourceId: { $in: sourceIds } })
    .select(selectFields)
    .lean();

  return new Map(items.map((item) => [item.sourceId, item]));
}

function buildDuplicateBulkOperations(groups, sourceMap, type) {
  const operations = [];

  for (const sourceIds of groups) {
    const items = sourceIds
      .map((sourceId) => sourceMap.get(sourceId))
      .filter(Boolean);

    const fallbackName = items.find((item) => item.name)?.name || `Nhóm duplicate ${sourceIds[0]}`;
    const entries = buildDuplicateEntriesFromItems(sourceIds, items, type);
    const summary = summarizeDuplicateEntries(entries, type);

    operations.push({
      updateOne: {
        filter: { type, sourceIds: { $in: sourceIds } },
        update: {
          $set: {
            type,
            name: fallbackName,
            sourceIds,
            entries: summary.entries,
            relistCount: summary.relistCount,
            firstPrice: summary.firstPrice,
            latestPrice: summary.latestPrice,
            isPriceDrop: summary.isPriceDrop,
            priceDropPercent: summary.priceDropPercent,
            rootId: summary.rootId,
          },
        },
        upsert: true,
      },
    });
  }

  return operations;
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

function normalizePropertyRows(allItems) {
  const rows = Array.isArray(allItems) ? allItems : [];

  return rows.map((p) => {
    const startPrice = Number(p.propertyStartPrice) || 0;
    const rawDeposit = Number(p.deposit) || 0;
    const hasPercentDeposit = p.depositUnit === 1 && rawDeposit > 0 && rawDeposit <= 100;
    const deposit = hasPercentDeposit
      ? Math.round((startPrice * rawDeposit) / 100)
      : rawDeposit;
    const depositPercent = hasPercentDeposit ? `${rawDeposit}%` : '';

    return {
      name: p.propertyName || p.propertyDesc || '',
      amount: p.propertyAmount || '01',
      startPrice,
      deposit,
      depositPercent,
      place: p.propertyPlace || '',
      quality: p.propertyQuality || '',
    };
  });
}

async function fetchAuctionItemDetail(sourceId) {
  const updates = {};
  let files = [];

  // ⚡ Gọi 3 API song song thay vì tuần tự
  const [propResult, viewResult, pubResult] = await Promise.allSettled([
    fetchAPI('/portal/propertyInfo', { auctionInfoId: sourceId }),
    fetchAPI('/portal/viewDetailAuctionInfo', { auctionInfoId: sourceId }),
    fetchPublishHistory(sourceId),
  ]);

  // 1. propertyInfo → tên tài sản, giá, địa chỉ, danh sách tài sản
  if (propResult.status === 'fulfilled' && propResult.value) {
    const json = propResult.value;
    if (json.items && json.items.length > 0) {
      const allItems = json.items;
      const prop = allItems[0];
      if (prop.propertyPlace) updates.address = prop.propertyPlace;
      if (prop.fileCost) updates.applicationFee = prop.fileCost;
      if (prop.propertyAmount) updates.propertyAmount = prop.propertyAmount;
      if (prop.propertyQuality) updates.quality = prop.propertyQuality;

      // ★ FIX: Lấy tên tài sản từ propertyInfo (list API thường không có)
      const assetName = allItems
        .map(p => p.propertyName || p.propertyDesc || '')
        .filter(Boolean)
        .join('; ');
      if (assetName) updates.name = assetName;

      const properties = normalizePropertyRows(allItems);
      const safeProperties = Array.isArray(properties) ? properties : [];
      updates.properties = safeProperties;

      const totalPrice = safeProperties.reduce((s, p) => s + (p.startPrice || 0), 0);
      const totalDeposit = safeProperties.reduce((s, p) => s + (p.deposit || 0), 0);
      const percentDeposits = safeProperties
        .map((p) => p.depositPercent)
        .filter(Boolean);
      updates.initialPrice = totalPrice || undefined;
      updates.currentPrice = totalPrice || undefined;
      updates.deposit = totalDeposit || undefined;
      updates.depositPercent = percentDeposits.length === 1
        ? percentDeposits[0]
        : percentDeposits.length > 1
          ? percentDeposits.join(' + ')
          : undefined;
    }
  }

  // 2. viewDetailAuctionInfo → tên tài sản (fallback) + files
  if (viewResult.status === 'fulfilled' && viewResult.value) {
    const viewDetail = viewResult.value;

    // ★ FIX: Fallback lấy tên tài sản từ viewDetail nếu propertyInfo không có
    if (!updates.name && viewDetail.subPropertyName) {
      updates.name = viewDetail.subPropertyName;
    }
    // Lấy shortDescription nếu có
    if (viewDetail.subPropertyName) {
      updates.shortDescription = viewDetail.subPropertyName;
    }

    if (Array.isArray(viewDetail.listFile) && viewDetail.listFile.length > 0) {
      files = viewDetail.listFile
        .filter(f => f.linkFile)
        .map(f => ({
          name: f.fileName,
          url: `https://dgts.moj.gov.vn/portal/downloadFile?linkFile=${encodeURIComponent(f.linkFile)}`
        }));
    }
  }

  // 3. pageAuctionInfoPublish2 → đăng lần mấy
  if (pubResult.status === 'fulfilled' && pubResult.value) {
    Object.assign(updates, pubResult.value);
  }

  return { updates, files };
}

// ═══════════════════════════════════════════════════════
// HELPER: Chi tiết LỰA CHỌN TỔ CHỨC
// ═══════════════════════════════════════════════════════

async function fetchOrgItemDetail(sourceId) {
  const updates = {};
  let files = [];

  // ⚡ Gọi 2 API song song
  const [propResult, editResult] = await Promise.allSettled([
    fetchAPI('/portal/propertyInfo', { auctionInfoId: sourceId }),
    fetchAPI('/ThongTin/getInfoEditNotice', { id: sourceId }),
  ]);

  // 1. propertyInfo → tên tài sản, giá, địa chỉ
  if (propResult.status === 'fulfilled' && propResult.value) {
    const json = propResult.value;
    if (json.items && json.items.length > 0) {
      const allItems = json.items;
      const prop = allItems[0];
      if (prop.propertyPlace) updates.address = prop.propertyPlace;
      if (prop.propertyQuality) updates.propertyTypeName = prop.propertyQuality;

      // ★ FIX: Lấy tên tài sản từ propertyInfo
      const assetName = allItems
        .map(p => p.propertyName || p.propertyDesc || '')
        .filter(Boolean)
        .join('; ');
      if (assetName) updates.name = assetName;

      const properties = normalizePropertyRows(allItems);
      const safeProperties = Array.isArray(properties) ? properties : [];
      updates.properties = safeProperties;
      const percentDeposits = safeProperties
        .map((p) => p.depositPercent)
        .filter(Boolean);
      updates.startingPrice = safeProperties.reduce((s, p) => s + (p.startPrice || 0), 0);
      updates.depositPercent = percentDeposits.length === 1
        ? percentDeposits[0]
        : percentDeposits.length > 1
          ? percentDeposits.join(' + ')
          : undefined;
    }
  }

  // 2. getInfoEditNotice → files
  if (editResult.status === 'fulfilled' && editResult.value) {
    const editNotice = editResult.value;
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
        return { item, updates, files, success: true };
      } catch (err) {
        return { item, success: false, err };
      }
    }));

    for (const result of chunkResults) {
      if (result.success) {
        const { item, updates, files } = result;
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;
        
        await OrgSelection.updateOne({ _id: item._id }, { $set: updates });
        
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

async function recoverMissingDuplicates(onProgress, shouldStop) {
  console.log(`\n🔄 [Duplicate] Khôi phục bài đăng bị thiếu trong Duplicate groups...`);
  const dups = await Duplicate.find({});
  let recoveredCount = 0;
  let scannedGroups = 0;

  const reportProgress = async (message) => {
    if (typeof onProgress === 'function') {
      await onProgress(message);
    }
  };

  for (const dup of dups) {
    if (typeof shouldStop === 'function' && shouldStop()) {
      await reportProgress(`Đã nhận yêu cầu dừng khi đang khôi phục duplicate thiếu ở nhóm ${scannedGroups}/${dups.length}.`);
      break;
    }

    scannedGroups += 1;

    if (!dup.sourceIds || dup.sourceIds.length === 0) {
      if (scannedGroups % 25 === 0) {
        await reportProgress(`Khôi phục duplicate thiếu: đã kiểm tra ${scannedGroups}/${dups.length} nhóm, phục hồi ${recoveredCount} bài`);
      }
      continue;
    }

    const Model = dup.type === 'org' ? OrgSelection : AuctionNotice;
    const existingItems = await Model.find({ sourceId: { $in: dup.sourceIds } }).select('sourceId').lean();
    const existingIds = existingItems.map(i => i.sourceId);

    const missingIds = dup.sourceIds.filter(id => !existingIds.includes(id));
    if (missingIds.length === 0) {
      if (scannedGroups % 25 === 0) {
        await reportProgress(`Khôi phục duplicate thiếu: đã kiểm tra ${scannedGroups}/${dups.length} nhóm, phục hồi ${recoveredCount} bài`);
      }
      continue;
    }

    await reportProgress(`Khôi phục duplicate thiếu: nhóm ${scannedGroups}/${dups.length}, còn thiếu ${missingIds.length} bài`);

    for (const missingId of missingIds) {
      if (typeof shouldStop === 'function' && shouldStop()) {
        await reportProgress(`Đã nhận yêu cầu dừng khi đang phục hồi ID ${missingId}.`);
        break;
      }

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
        
        if (recoveredCount % 10 === 0) {
          await reportProgress(`Khôi phục duplicate thiếu: đã phục hồi ${recoveredCount} bài, kiểm tra ${scannedGroups}/${dups.length} nhóm`);
        }
      } catch (err) {
        console.error(`Lỗi phục hồi ID ${missingId}:`, err.message);
      }
    }

    // Sau khi recover xong, rebuild entries cho dup này
    await handleDuplicate(dup.sourceIds[0], dup.name, dup.sourceIds.slice(1), dup.type);
  }
  
  await reportProgress(`Khôi phục duplicate thiếu hoàn tất: ${recoveredCount} bài / ${dups.length} nhóm`);
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
async function rebuildAllDuplicateEntries(shouldStop, onProgress) {
  console.log(`\n🔄 [Duplicate] Rebuild entries cho tất cả nhóm...`);
  const duplicates = await Duplicate.find({});
  let updatedCount = 0;

  for (const dup of duplicates) {
    if (typeof shouldStop === 'function' && shouldStop()) {
      if (typeof onProgress === 'function') {
        await onProgress(`Đã nhận yêu cầu dừng khi đang rebuild duplicate (${updatedCount}/${duplicates.length} nhóm).`);
      }
      break;
    }

    if (!dup.sourceIds || dup.sourceIds.length === 0) continue;

    const entries = await buildDuplicateEntries(dup.sourceIds, dup.type);
    dup.entries = entries;
    dup.relistCount = entries.length;

    const pricesWithValues = entries.filter(e => e.price && e.price > 0);
    if (pricesWithValues.length > 0) {
      dup.firstPrice = pricesWithValues[0].price;
      dup.latestPrice = pricesWithValues[pricesWithValues.length - 1].price;

      const uniqueTimestamps = [...new Set(
        pricesWithValues
          .filter(e => e.publishedAt)
          .map(e => new Date(e.publishedAt).getTime())
      )];
      const isActualRelist = uniqueTimestamps.length >= 2;

      if (dup.type === 'auction' && dup.latestPrice < dup.firstPrice && isActualRelist) {
        dup.isPriceDrop = true;
        dup.priceDropPercent = Math.round((1 - dup.latestPrice / dup.firstPrice) * 10000) / 100;
      } else {
        dup.isPriceDrop = false;
        dup.priceDropPercent = 0;
      }
    } else {
      dup.firstPrice = 0;
      dup.latestPrice = 0;
      dup.isPriceDrop = false;
      dup.priceDropPercent = 0;
    }

    const entryWithRoot = entries.find(e => e.rootId);
    if (entryWithRoot) dup.rootId = entryWithRoot.rootId;

    await dup.save();
    updatedCount++;

    if (updatedCount % 100 === 0) {
      console.log(`  ✅ ${updatedCount}/${duplicates.length} nhóm`);
      if (typeof onProgress === 'function') {
        await onProgress(`Rebuild duplicate: đã cập nhật ${updatedCount}/${duplicates.length} nhóm`);
      }
    }
  }

  console.log(`✅ Rebuild hoàn thành: ${updatedCount} nhóm.`);
  return updatedCount;
}

async function runFullDuplicateScan() {
  duplicateScanState.isRunning = true;
  duplicateScanState.cancelRequested = false;

  const log = await CrawlLog.create({
    type: 'duplicate_scan',
    startedAt: new Date(),
    status: 'running',
    itemsUpdated: 0,
    itemsSkipped: 0,
    pagesProcessed: 0,
    errorMessages: ['Bắt đầu quét duplicate toàn bộ dữ liệu.'],
  });

  const progressEvery = 25;

  const saveProgress = async (message) => {
    if (message) {
      const currentMessages = Array.isArray(log.errorMessages) ? log.errorMessages : [];
      log.errorMessages = [...currentMessages.slice(-4), message];
    }
    await log.save();
  };

  const ensureNotCancelled = async (message) => {
    if (!duplicateScanState.cancelRequested) {
      return;
    }

    log.status = 'failed';
    log.finishedAt = new Date();
    const cancelMessage = message || 'Tiến trình quét duplicate đã được dừng thủ công.';
    const currentMessages = Array.isArray(log.errorMessages) ? log.errorMessages : [];
    log.errorMessages = [...currentMessages.slice(-4), cancelMessage];
    await log.save();

    const cancelError = new Error(cancelMessage);
    cancelError.code = 'DUPLICATE_SCAN_CANCELLED';
    throw cancelError;
  };

  const processTypeGroups = async (type, label, rawItems, nameGroups) => {
    await ensureNotCancelled(`Đã dừng trước khi xử lý ${label}.`);
    await saveProgress(`Đang gom cụm ${label} theo relatedIds...`);
    const relatedGroups = buildGraphGroups(rawItems, (item) => item.relatedIds);

    await ensureNotCancelled(`Đã dừng khi đang gom cụm ${label}.`);
    await saveProgress(`Đang gom cụm ${label} theo tên (${nameGroups.length} nhóm tên)...`);
    const normalizedNameGroups = nameGroups
      .map((group) => Array.isArray(group.ids) ? [...new Set(group.ids)].sort((a, b) => a - b) : [])
      .filter((group) => group.length >= 2);

    const mergedGroups = mergeDuplicateGroups(relatedGroups, normalizedNameGroups);
    const allSourceIds = [...new Set(mergedGroups.flat())];

    log.pagesProcessed += relatedGroups.length + normalizedNameGroups.length;
    if (mergedGroups.length === 0 || allSourceIds.length === 0) {
      log.itemsSkipped += rawItems.length;
      await saveProgress(`${label}: không có cụm duplicate hợp lệ.`);
      return;
    }

    await ensureNotCancelled(`Đã dừng trước khi preload dữ liệu ${label}.`);
    await saveProgress(`Đang preload dữ liệu ${label} (${allSourceIds.length} sourceIds / ${mergedGroups.length} cụm)...`);
    const sourceMap = await fetchDuplicateSourceMap(type, allSourceIds);
    const operations = buildDuplicateBulkOperations(mergedGroups, sourceMap, type);

    if (operations.length === 0) {
      log.itemsSkipped += rawItems.length;
      await saveProgress(`${label}: không tạo được batch update.`);
      return;
    }

    for (let index = 0; index < operations.length; index += progressEvery) {
      await ensureNotCancelled(`Đã dừng khi đang cập nhật duplicate ${label}.`);
      const batch = operations.slice(index, index + progressEvery);
      await Duplicate.bulkWrite(batch, { ordered: false });
      log.itemsUpdated += batch.length;
      await saveProgress(`${label}: đã cập nhật ${Math.min(index + batch.length, operations.length)}/${operations.length} cụm duplicate`);
    }
  };

  try {
    console.log('[TRIGGER] Starting full duplicate scan...');

    const auctions = await AuctionNotice.find({ relatedIds: { $exists: true, $not: { $size: 0 } } })
      .select('sourceId relatedIds')
      .lean();
    const nameGroupsAuction = await AuctionNotice.aggregate([
      { $match: { name: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$name', ids: { $push: '$sourceId' }, count: { $sum: 1 } } },
      { $match: { count: { $gte: 2 } } }
    ]);
    await processTypeGroups('auction', 'AuctionNotice', auctions, nameGroupsAuction);

    const orgs = await OrgSelection.find({ relatedIds: { $exists: true, $not: { $size: 0 } } })
      .select('sourceId relatedIds')
      .lean();
    const nameGroupsOrg = await OrgSelection.aggregate([
      { $match: { name: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$name', ids: { $push: '$sourceId' }, count: { $sum: 1 } } },
      { $match: { count: { $gte: 2 } } }
    ]);
    await processTypeGroups('org', 'OrgSelection', orgs, nameGroupsOrg);

    await ensureNotCancelled('Đã dừng trước khi khôi phục duplicate bị thiếu.');
    await saveProgress('Đang khôi phục duplicate bị thiếu...');
    await recoverMissingDuplicates(saveProgress, () => duplicateScanState.cancelRequested);

    await ensureNotCancelled('Đã dừng trước khi rebuild toàn bộ duplicate entries.');
    await saveProgress('Đang rebuild toàn bộ entries duplicate...');
    await rebuildAllDuplicateEntries(() => duplicateScanState.cancelRequested, saveProgress);

    await ensureNotCancelled('Đã dừng trước khi hoàn tất quét duplicate.');
    log.status = 'completed';
    log.finishedAt = new Date();
    await saveProgress('Quét duplicate hoàn tất.');

    console.log('[TRIGGER] Full duplicate scan and recovery completed.');
    return { success: true, logId: log._id };
  } catch (err) {
    if (log.status !== 'failed') {
      log.status = 'failed';
      log.finishedAt = new Date();
      log.errorMessages = [err instanceof Error ? err.message : String(err)].filter(Boolean);
      await log.save();
    }
    console.error('[TRIGGER] Error in duplicate scan:', err);
    throw err;
  } finally {
    resetDuplicateScanState();
  }
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
  runFullDuplicateScan,
  requestDuplicateScanCancel,
  getDuplicateScanState,
};
