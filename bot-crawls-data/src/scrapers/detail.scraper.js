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
const AssetItem = require('../models/AssetItem');
const PotentialDuplicate = require('../models/PotentialDuplicate');
const { delay, slugify, extractProvince, normalizeProvince, getBigrams, jaccardSimilarity, overlapSimilarity, extractCoreIdentity, getNumberTokens, extractPropertyIdentifiers, hasConflictingIdentifiers, hasMatchingStrongIdentifiers, isSignificantNumber, isGenericTitle, extractLocationIdentity, generateBlockingKeys, detectHardConflict, compareArea, compareRelistPrice, scoreAssetPair } = require('../utils/helpers');

const duplicateScanState = {
  isRunning: false,
  cancelRequested: false,
  skipDetailCrawl: true, // Thêm cờ để bỏ qua cào dữ liệu khi bị block
};

function requestDuplicateScanCancel() {
  if (!duplicateScanState.isRunning) {
    return false;
  }
  duplicateScanState.cancelRequested = true;
  return true;
}

function setSkipDetailCrawl(skip) {
  duplicateScanState.skipDetailCrawl = !!skip;
  return duplicateScanState.skipDetailCrawl;
}

function resetDuplicateScanState() {
  duplicateScanState.isRunning = false;
  duplicateScanState.cancelRequested = false;
  // không reset skipDetailCrawl để user giữ tuỳ chọn này
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

  // Tìm tất cả các duplicate đã có chứa bất kỳ ID nào
  const existingDups = await Duplicate.find({
    sourceIds: { $in: allIds },
    type,
  });

  let dup;
  if (existingDups.length > 0) {
    // Thu thập tất cả các ID từ các duplicate tìm được
    const existingIds = existingDups.reduce((acc, d) => acc.concat(d.sourceIds), []);
    const merged = [...new Set([...allIds, ...existingIds])].sort((a, b) => a - b);
    
    // Xoá tất cả các bản ghi duplicate cũ này để gộp thành 1
    const idsToDelete = existingDups.map(d => d._id);
    await Duplicate.deleteMany({ _id: { $in: idsToDelete } });

    // Tạo bản ghi duy nhất
    dup = new Duplicate({ name: name || existingDups[0].name, sourceIds: merged, type });
  } else {
    dup = new Duplicate({ name, sourceIds: allIds, type });
  }

  // Nạp chi tiết giá + ngày từ DB cho tất cả sourceIds
  const entries = await buildDuplicateEntries(dup.sourceIds, type);
  dup.entries = entries;
  dup.relistCount = new Set(entries.map(e => e.publishRound).filter(r => r > 0)).size || entries.length;

  // Lấy province, district, commune và organizer từ các entry
  const Model = type === 'org' ? OrgSelection : AuctionNotice;
  const dbItems = await Model.find({ sourceId: { $in: dup.sourceIds } }).select('province organizer name').lean();
  
  const firstItem = dbItems[0];
  if (firstItem) {
    const ids = extractPropertyIdentifiers(firstItem.name);
    if (ids.district) dup.district = ids.district;
    if (ids.commune) dup.commune = ids.commune;
  }

  const prov = dbItems.find(i => i.province)?.province;
  const org = dbItems.find(i => i.organizer)?.organizer;
  if (prov) dup.province = prov;
  if (org) dup.organizer = org;

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

  const entries = items.map((item) => ({
    sourceId: item.sourceId,
    name: item.name || '',
    price: item[priceField] || item.currentPrice || 0,
    publishedAt: item.publishedAt,
    publishRound: item.publishRound || 0,
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

  // Gom các entries cùng ngày đăng thành cùng 1 round (bản đính chính/liên quan)
  let currentRound = 0;
  let lastDateKey = '';
  for (const entry of entries) {
    if (!entry.publishedAt) {
      entry.publishRound = entry.publishRound || 0;
      continue;
    }
    const dateKey = new Date(entry.publishedAt).toISOString().slice(0, 10); // YYYY-MM-DD
    if (dateKey !== lastDateKey) {
      currentRound++;
      lastDateKey = dateKey;
    }
    entry.publishRound = currentRound;
  }

  return entries;
}

function isAuctionDetailIncomplete(item) {
  // Chỉ kiểm tra các trường có thể lấy được từ API Detail
  return item.detailScraped !== true
    || !Array.isArray(item.properties)
    || item.properties.length === 0
    || !item.initialPrice
    || !item.address
    || !item.name
    || !item.province
    || !item.sourceUrl;
}

async function recrawlMissingAuctionDetails(sourceIds, options = {}) {
  const ids = [...new Set((sourceIds || []).map((id) => Number(id)).filter(Boolean))];
  if (ids.length === 0) return { updated: 0, skipped: 0, errors: 0 };

  const items = await AuctionNotice.find({ sourceId: { $in: ids } })
    .select('_id sourceId detailScraped properties initialPrice address name province')
    .lean();
  const itemBySourceId = new Map(items.map((item) => [item.sourceId, item]));
  const force = options.force === true;
  const concurrency = 1; // Luôn cào từng bài một để tránh anti-bot
  const targets = ids
    .map((id) => itemBySourceId.get(id))
    .filter(Boolean)
    .filter((item) => force || isAuctionDetailIncomplete(item));

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < targets.length; i += concurrency) {
    const chunk = targets.slice(i, i + concurrency);
    const results = await Promise.all(chunk.map(async (item) => {
      try {
        const { updates, files } = await fetchAuctionItemDetail(item.sourceId);
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;
        await AuctionNotice.updateOne({ _id: item._id }, { $set: updates });
        await delay(1500 + Math.random() * 1500); // Thêm delay tránh anti-bot
        return true;
      } catch (err) {
        console.error(`[Detail Related] ❌ ${item.sourceId}:`, err.message);
        return false;
      }
    }));

    updated += results.filter(Boolean).length;
    errors += results.filter((ok) => !ok).length;
  }

  return { updated, skipped: ids.length - targets.length, errors };
}

function summarizeDuplicateEntries(entries, type, multiAssetSet) {
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

  const publishedTimes = entries
    .map((entry) => entry.publishedAt)
    .filter(Boolean)
    .map((date) => new Date(date).getTime());
  const lastPublishedAt = publishedTimes.length > 0
    ? new Date(Math.max(...publishedTimes))
    : null;

  const entryWithRoot = entries.find((entry) => entry.rootId);
  let rootId = entryWithRoot ? entryWithRoot.rootId : (entries[0] ? entries[0].sourceId : null);

  if (type === 'auction' && multiAssetSet && entries.length > 0) {
    // If the first entry is a batch notice, find the first single-asset notice in this duplicate group
    const firstSingleAsset = entries.find(e => !multiAssetSet.has(e.sourceId));
    if (firstSingleAsset) {
      rootId = firstSingleAsset.sourceId;
    }
  }

  return {
    entries,
    relistCount: new Set(entries.map(e => e.publishRound).filter(r => r > 0)).size || entries.length,
    firstPrice,
    latestPrice,
    isPriceDrop,
    priceDropPercent,
    lastPublishedAt,
    rootId,
  };
}

async function buildGraphGroups(items, getRelatedIds) {
  const adjacency = new Map();

  const ensureNode = (id) => {
    if (!adjacency.has(id)) {
      adjacency.set(id, new Set());
    }
    return adjacency.get(id);
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || !item.sourceId) continue;

    const sourceId = item.sourceId;
    const relatedIds = Array.isArray(getRelatedIds(item)) ? getRelatedIds(item) : [];
    const node = ensureNode(sourceId);

    for (const relatedId of relatedIds) {
      if (!relatedId || relatedId === sourceId) continue;
      node.add(relatedId);
      ensureNode(relatedId).add(sourceId);
    }

    if (i % 10000 === 0) {
      await new Promise(r => setImmediate(r));
    }
  }

  const visited = new Set();
  const groups = [];

  let idx = 0;
  for (const sourceId of adjacency.keys()) {
    idx++;
    if (idx % 10000 === 0) {
      await new Promise(r => setImmediate(r));
    }

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


function mergeDuplicateGroups(groupSets, multiAssetSet) {
  let sets = [];
  let maskSet = new Set();
  if (Array.isArray(groupSets) && groupSets.length > 0 && Array.isArray(groupSets[0]) && (multiAssetSet instanceof Set)) {
    sets = groupSets;
    maskSet = multiAssetSet;
  } else {
    sets = Array.prototype.slice.call(arguments);
    if (sets[sets.length - 1] instanceof Set) {
      maskSet = sets.pop();
    }
  }

  const adjacency = new Map();
  let virtualIdCounter = 1;

  const ensureNode = (id) => {
    if (!adjacency.has(id)) {
      adjacency.set(id, new Set());
    }
  };

  for (const groups of sets) {
    for (const group of groups) {
      if (!Array.isArray(group) || group.length < 2) continue;

      const groupMapped = group.map(id => {
        if (maskSet.has(id)) {
          return `v_${id}_${virtualIdCounter++}`;
        }
        return id;
      });

      for (let i = 0; i < groupMapped.length; i++) {
        ensureNode(groupMapped[i]);
        if (i > 0) {
          adjacency.get(groupMapped[i]).add(groupMapped[i - 1]);
          adjacency.get(groupMapped[i - 1]).add(groupMapped[i]);
        }
      }
    }
  }

  const visited = new Set();
  const mergedGroups = [];

  for (const [node, _] of adjacency.entries()) {
    if (visited.has(node)) continue;

    const group = [];
    const queue = [node];
    visited.add(node);

    while (queue.length > 0) {
      const current = queue.shift();
      group.push(current);

      for (const neighbor of adjacency.get(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (group.length >= 2) {
      const originalGroup = group.map(id => {
        if (typeof id === 'string' && id.startsWith('v_')) {
          const parts = id.split('_');
          return parseInt(parts[1]);
        }
        return id;
      });
      mergedGroups.push([...new Set(originalGroup)].sort((a, b) => a - b));
    }
  }

  return mergedGroups;
}

async function fetchDuplicateSourceMap(type, sourceIds) {
  const Model = type === 'org' ? OrgSelection : AuctionNotice;
  const priceField = type === 'org' ? 'startingPrice' : 'initialPrice';
  const selectFields = type === 'org'
    ? `sourceId name province organizer ${priceField} publishedAt publishRound publishRoundLabel rootId sourceUrl`
    : `sourceId name province organizer ${priceField} currentPrice publishedAt publishRound publishRoundLabel rootId sourceUrl`;

  const items = await Model.find({ sourceId: { $in: sourceIds } })
    .select(selectFields)
    .lean();

  return new Map(items.map((item) => [item.sourceId, item]));
}

function buildDuplicateBulkOperations(groups, sourceMap, type, multiAssetSet) {
  const operations = [];

  for (const sourceIds of groups) {
    const items = sourceIds
      .map((sourceId) => sourceMap.get(sourceId))
      .filter(Boolean);

    const fallbackName = items.find((item) => item.name)?.name || `Nhóm duplicate ${sourceIds[0]}`;
    const entries = buildDuplicateEntriesFromItems(sourceIds, items, type);
    const summary = summarizeDuplicateEntries(entries, type, multiAssetSet);

    operations.push({
      updateOne: {
        filter: { type, rootId: summary.rootId },
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
            lastPublishedAt: summary.lastPublishedAt,
            rootId: summary.rootId,
            province: items.find((item) => item.province)?.province || null,
            district: (() => { const ids = extractPropertyIdentifiers(items[0]?.name); return ids.district || null; })(),
            commune: (() => { const ids = extractPropertyIdentifiers(items[0]?.name); return ids.commune || null; })(),
            organizer: items.find((item) => item.organizer)?.organizer || null,
          },
        },
        upsert: true,
      },
    });
  }

  return operations;
}

/**
 * Tìm các ID trùng lặp bằng cách kết hợp API search và Fuzzy Match local (>= 70% similarity)
 */
async function searchDuplicatesByFuzzyName(sourceId, name, type, skipApiSearch = false, fallbackProvince = null) {
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

    // ★ TỐI ƯU TỐC ĐỘ VÀ CHỐNG CHẾT MONGODB (Parallel Execution + Force Text Index)
    const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const Model = type === 'auction' ? AuctionNotice : OrgSelection;
    const targetProvince = extractProvince(name) || (fallbackProvince ? normalizeProvince(fallbackProvince) : '');
    const provMatch = targetProvince === 'TP. Hồ Chí Minh' 
        ? ['TP. Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'TP Hồ Chí Minh', 'Hồ Chí Minh', null, ''] 
        : targetProvince ? [targetProvince, null, ''] : null;

    // 1. Query: $text search tổng quát
    const dbQuery = { $text: { $search: name } };
    if (provMatch) dbQuery.province = { $in: provMatch };

    // 2. Query: Fallback regex cho các số quan trọng
    const targetNumbers = getNumberTokens(name);
    const targetIdentifiers = extractPropertyIdentifiers(name);
    let searchNumbers = targetNumbers;
    if (targetNumbers.length > 10) {
      searchNumbers = [];
      if (targetIdentifiers.plotNumber) searchNumbers.push(targetIdentifiers.plotNumber);
      if (targetIdentifiers.mapSheet) searchNumbers.push(targetIdentifiers.mapSheet);
      if (targetIdentifiers.houseNumber) searchNumbers.push(targetIdentifiers.houseNumber);
      if (targetIdentifiers.certificateNumber) searchNumbers.push(targetIdentifiers.certificateNumber);
      if (targetIdentifiers.licensePlate) searchNumbers.push(targetIdentifiers.licensePlate);
      const specialNums = targetNumbers.filter(n => n.includes('/') || n.includes('-') || n.length >= 5);
      searchNumbers = [...new Set([...searchNumbers, ...specialNums])].slice(0, 10);
    }

    let regexDbQuery = null;
    if (searchNumbers.length > 0) {
      const regexQueries = searchNumbers.map(num => ({ name: { $regex: "(^|\\s)" + escapeRegex(num) + "(\\s|$|\\.|,|\\)|/)", $options: 'i' } }));
      regexDbQuery = { 
        $text: { $search: searchNumbers.join(' ') }, // Dùng OR search thay vì AND (quotes) để không bắt buộc phải có tất cả các số
        $or: regexQueries 
      };
      if (provMatch) regexDbQuery.province = { $in: provMatch };
    }

    // 3. Query: Định danh mạnh (Sổ đỏ, Biển số, Số khung, Hợp đồng, Khoản nợ...)
    let strongDbQuery = null;
    const strongKeys = [
      'licensePlate', 'chassisNumber', 'engineNumber', 
      'certificateNumber', 'certificateEntryNumber', 'shipNumber', 
      'taxCode', 'contractNumber', 'ownerName', 'stockAmount', 'serialNumber', 'debtorName', 'apartment'
    ];
    if (targetIdentifiers.houseNumber && (targetIdentifiers.houseNumber.includes('/') || targetIdentifiers.houseNumber.includes('-') || targetIdentifiers.houseNumber.length >= 3)) {
        strongKeys.push('houseNumber');
    }
    
    const hasAnyStrongKey = strongKeys.some(k => targetIdentifiers[k]) || (targetIdentifiers.plotNumber && targetIdentifiers.mapSheet);

    if (hasAnyStrongKey) {
        const strongQueries = [];
        const strongTokens = [];

        // Thửa + Tờ (phải đi cùng nhau mới là định danh mạnh)
        if (targetIdentifiers.plotNumber && targetIdentifiers.mapSheet) {
            strongQueries.push({
                $and: [
                    { name: { $regex: "(^|\\s)" + escapeRegex(targetIdentifiers.plotNumber) + "(\\s|$|\\.|,|\\)|/)", $options: 'i' } },
                    { name: { $regex: "(^|\\s)" + escapeRegex(targetIdentifiers.mapSheet) + "(\\s|$|\\.|,|\\)|/)", $options: 'i' } }
                ]
            });
            strongTokens.push(targetIdentifiers.plotNumber, targetIdentifiers.mapSheet);
        }

        const pushStrong = (idVal) => {
            if (idVal) {
                // Thoát các ký tự đặc biệt cho regex và tìm kiếm chính xác
                strongQueries.push({ name: { $regex: escapeRegex(idVal), $options: 'i' } });
                strongTokens.push(idVal);
            }
        };

        // Đẩy tất cả các định danh mạnh vào câu truy vấn
        for (const key of strongKeys) {
            pushStrong(targetIdentifiers[key]);
        }

        if (strongQueries.length > 0) {
            strongDbQuery = { 
                $text: { $search: strongTokens.join(' ') },
                $or: strongQueries 
            };
            if (provMatch) strongDbQuery.province = { $in: provMatch };
        }
    }

    // ★ THỰC THI TẤT CẢ QUERIES (API + 3 DB QUERIES) SONG SONG
    const [apiRes, dbCandidates, dbCandidatesRegex, dbCandidatesStrong] = await Promise.all([
      skipApiSearch ? Promise.resolve(null) : fetchAPI(endpoint, payload).catch(err => { console.error(`[API Search] Lỗi ${sourceId}:`, err.message); return null; }),
      Model.find(dbQuery, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(300).select('sourceId name').lean(),
      regexDbQuery ? Model.find(regexDbQuery, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(200).select('sourceId name').lean() : Promise.resolve([]),
      strongDbQuery ? Model.find(strongDbQuery, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(200).select('sourceId name').lean() : Promise.resolve([])
    ]);

    let apiCandidates = [];
    if (apiRes && apiRes.items && apiRes.items.length >= 2 && apiRes.rowCount < 100) {
      apiRes.items.forEach(i => {
        if (i.id && i.id !== sourceId) {
          apiCandidates.push({ sourceId: i.id, name: i.nameAsset || i.name || i.assetName || '' });
        }
      });
    }

    // Gộp candidates
    const candidates = [...apiCandidates, ...dbCandidates, ...dbCandidatesRegex, ...dbCandidatesStrong];

    // ★ THUẬT TOÁN V2: So sánh trên LÕI DANH TÍNH (đã loại bỏ boilerplate pháp lý)
    const targetCore = extractCoreIdentity(name);
    const targetCoreBigrams = getBigrams(targetCore);
    // targetIdentifiers đã extract ở trên

    for (const c of candidates) {
      if (c.sourceId === sourceId) continue;

      const candidateNumbers = getNumberTokens(c.name);
      const candidateIdentifiers = extractPropertyIdentifiers(c.name);

      // BƯỚC 1: Xung đột ĐỊNH DANH (VD: Thửa đất số 01 vs Thửa đất số 02) → REJECT NGAY
      if (hasConflictingIdentifiers(targetIdentifiers, candidateIdentifiers)) {
        continue;
      }

      // BƯỚC 1.5: Định danh MẠNH trùng khớp tuyệt đối (VD: Cùng biển số xe, số khung, số sổ đỏ) → CHẤP NHẬN NGAY
      if (hasMatchingStrongIdentifiers(targetIdentifiers, candidateIdentifiers)) {
        relatedIds.push(c.sourceId);
        continue;
      }

      // BƯỚC 2: Kiểm tra số (Số nhà, số thửa, số tờ bản đồ...)
      const bothHaveNumbers = targetNumbers.length > 0 && candidateNumbers.length > 0;
      let commonNumbers = [];
      if (bothHaveNumbers) {
        commonNumbers = targetNumbers.filter(t => candidateNumbers.includes(t));
      }

      // BƯỚC 3: So sánh LÕI DANH TÍNH (đã loại bỏ boilerplate pháp lý)
      const candidateCore = extractCoreIdentity(c.name);
      const candidateCoreBigrams = getBigrams(candidateCore);
      const coreSim = jaccardSimilarity(targetCoreBigrams, candidateCoreBigrams);
      const overlapSim = overlapSimilarity(targetCoreBigrams, candidateCoreBigrams);

      // Core sim >= 80% → MATCH (rất chính xác vì đã lọc sạch rác)
      if (coreSim >= 0.80) {
        relatedIds.push(c.sourceId);
        continue;
      }

      // Có số chung + core sim >= 55% → MATCH (số đã xác nhận cùng tài sản)
      if (bothHaveNumbers && coreSim >= 0.55 && commonNumbers.length > 0) {
        relatedIds.push(c.sourceId);
        continue;
      }

      // Overlap sim >= 85% + chung ít nhất 1 số → MATCH
      if (bothHaveNumbers && overlapSim >= 0.85 && commonNumbers.length >= 1) {
        relatedIds.push(c.sourceId);
        continue;
      }

      // CĂN HỘ: Cùng số căn hộ + tương đồng tương đối → MATCH
      if (targetIdentifiers.apartment && targetIdentifiers.apartment === candidateIdentifiers.apartment && (coreSim >= 0.20 || overlapSim >= 0.33)) {
        relatedIds.push(c.sourceId);
        continue;
      }

      // NHÀ PHỐ/ĐỊA CHỈ: Cùng số nhà và overlap >= 0.60
      if (targetIdentifiers.houseNumber && targetIdentifiers.houseNumber === candidateIdentifiers.houseNumber && overlapSim >= 0.60) {
        relatedIds.push(c.sourceId);
        continue;
      }
    }

    relatedIds = [...new Set(relatedIds)];
  } catch (err) {
    console.error(`[Duplicate Scan Error] ${sourceId}:`, err.message);
  }
  return relatedIds;
}

function normalizePropertyRows(allItems) {
  const rows = Array.isArray(allItems) ? allItems : [];

  return rows.map((p) => {
    const startPrice = Number(p.propertyStartPrice) || 0;
    const rawDeposit = Number(p.deposit) || 0;
    const hasPercentDeposit = p.depositUnit === 1 && rawDeposit > 0 && rawDeposit <= 100;
    const deposit = hasPercentDeposit ? 0 : rawDeposit;
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
  
  // Bỏ tự động tạo URL gốc để tránh ghi đè làm mất slug của URL đã lưu

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
      if (prop.propertyPlace) {
        updates.address = prop.propertyPlace;
        const province = extractProvince(prop.propertyPlace);
        if (province) updates.province = province;
      }
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

  // Bỏ tự động tạo URL gốc để tránh ghi đè làm mất slug của URL đã lưu

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
      updates.deposit = safeProperties.reduce((s, p) => s + (p.deposit || 0), 0);
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
        const exactNameRelatedIds = await searchDuplicatesByFuzzyName(item.sourceId, item.name, 'auction', false, updates.province || item.province);
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
          await recrawlMissingAuctionDetails([item.sourceId, ...allRelatedIds], { concurrency: config.crawl.concurrency || 30 });
          await handleDuplicate(item.sourceId, updates.name || item.name, allRelatedIds, 'auction');
        }
        stats.updated++;
      } else {
        stats.errors++;
        await AuctionNotice.updateOne({ _id: result.item._id }, { $set: { lastCrawledAt: new Date() } });
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
        await OrgSelection.updateOne({ _id: result.item._id }, { $set: { lastCrawledAt: new Date() } });
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

  // 1. Thu thập tất cả sourceIds từ tất cả các nhóm để tải một lần
  const allDupAuctionSourceIds = new Set();
  const allDupOrgSourceIds = new Set();
  for (const dup of dups) {
    if (!dup.sourceIds || dup.sourceIds.length === 0) continue;
    const targetSet = dup.type === 'org' ? allDupOrgSourceIds : allDupAuctionSourceIds;
    for (const id of dup.sourceIds) targetSet.add(id);
  }

  // 2. Tải tất cả các bản ghi hiện có từ DB bằng 2 truy vấn duy nhất
  console.log(`[Recover] Đang kiểm tra sự tồn tại của ${allDupAuctionSourceIds.size} auctions và ${allDupOrgSourceIds.size} orgs...`);
  const [existingAuctionItems, existingOrgItems] = await Promise.all([
    allDupAuctionSourceIds.size > 0
      ? AuctionNotice.find({ sourceId: { $in: Array.from(allDupAuctionSourceIds) } }).select('sourceId').lean()
      : Promise.resolve([]),
    allDupOrgSourceIds.size > 0
      ? OrgSelection.find({ sourceId: { $in: Array.from(allDupOrgSourceIds) } }).select('sourceId').lean()
      : Promise.resolve([])
  ]);

  const existingAuctions = new Set(existingAuctionItems.map(i => i.sourceId));
  const existingOrgs = new Set(existingOrgItems.map(i => i.sourceId));

  // 3. Quét qua các nhóm duplicate để tìm bài viết bị thiếu
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
    const existingIds = dup.type === 'org' ? existingOrgs : existingAuctions;
    const missingIds = dup.sourceIds.filter(id => !existingIds.has(id));

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
          url = `https://dgts.moj.gov.vn/thong-bao-cong-khai/${missingId}.html`;
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
        
        // Thêm vào existing Set để tránh bị quét lại trùng lặp trong các nhóm tiếp theo
        existingIds.add(missingId);
        recoveredCount++;

        if (recoveredCount % 10 === 0) {
          await reportProgress(`Khôi phục duplicate thiếu: đã phục hồi ${recoveredCount} bài, kiểm tra ${scannedGroups}/${dups.length} nhóm`);
        }
      } catch (err) {
        console.error(`Lỗi phục hồi ID ${missingId}:`, err.message);
      }
    }
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
async function rebuildAllDuplicateEntries(shouldStop, onProgress, filter = {}) {
  console.log(`\n🔄 [Duplicate] Rebuild entries cho các nhóm (Tối ưu hóa)...`);
  const duplicates = await Duplicate.find(filter);
  let updatedCount = 0;

  const reportProgress = async (message) => {
    if (typeof onProgress === 'function') {
      await onProgress(message);
    }
  };

  if (duplicates.length === 0) {
    console.log('✅ Không có nhóm nào để rebuild.');
    return 0;
  }

  // 1. Thu thập tất cả sourceIds cần truy vấn
  const auctionSourceIds = new Set();
  const orgSourceIds = new Set();
  for (const dup of duplicates) {
    if (!dup.sourceIds || dup.sourceIds.length === 0) continue;
    const targetSet = dup.type === 'org' ? orgSourceIds : auctionSourceIds;
    for (const id of dup.sourceIds) {
      targetSet.add(id);
    }
  }

  // 2. Preload tất cả bản ghi từ DB trong 2 query duy nhất
  console.log(`[Rebuild] Đang tải trước dữ liệu cho ${auctionSourceIds.size} auctions và ${orgSourceIds.size} orgs...`);
  await reportProgress(`Đang tải dữ liệu từ cơ sở dữ liệu...`);

  const [auctionItems, orgItems] = await Promise.all([
    auctionSourceIds.size > 0 
      ? AuctionNotice.find({ sourceId: { $in: Array.from(auctionSourceIds) } })
          .select('sourceId initialPrice currentPrice publishedAt publishRound publishRoundLabel rootId sourceUrl province organizer')
          .lean()
      : Promise.resolve([]),
    orgSourceIds.size > 0
      ? OrgSelection.find({ sourceId: { $in: Array.from(orgSourceIds) } })
          .select('sourceId startingPrice publishedAt publishRound publishRoundLabel rootId sourceUrl province organizer')
          .lean()
      : Promise.resolve([])
  ]);

  // Tạo map tra cứu nhanh
  const auctionMap = new Map(auctionItems.map(item => [item.sourceId, item]));
  const orgMap = new Map(orgItems.map(item => [item.sourceId, item]));

  console.log(`[Rebuild] Đang cập nhật thông tin trong bộ nhớ...`);
  const bulkOps = [];
  const noticeUpdates = []; // Để cập nhật ngược lại AuctionNotice / OrgSelection

  for (const dup of duplicates) {
    if (typeof shouldStop === 'function' && shouldStop()) {
      await reportProgress(`Đã nhận yêu cầu dừng khi đang rebuild duplicate (${updatedCount}/${duplicates.length} nhóm).`);
      break;
    }

    if (!dup.sourceIds || dup.sourceIds.length === 0) continue;

    const map = dup.type === 'org' ? orgMap : auctionMap;
    
    // Lấy các item tương ứng và sắp xếp theo publishedAt
    const items = dup.sourceIds
      .map(id => map.get(id))
      .filter(Boolean);

    if (items.length === 0) continue;

    const entries = buildDuplicateEntriesFromItems(dup.sourceIds, items, dup.type);
    
    const prov = items.find(i => i.province)?.province;
    const org = items.find(i => i.organizer)?.organizer;

    let firstPrice = 0;
    let latestPrice = 0;
    let isPriceDrop = false;
    let priceDropPercent = 0;

    const pricesWithValues = entries.filter(e => e.price && e.price > 0);
    if (pricesWithValues.length > 0) {
      firstPrice = pricesWithValues[0].price;
      latestPrice = pricesWithValues[pricesWithValues.length - 1].price;

      const uniqueTimestamps = [...new Set(
        pricesWithValues
          .filter(e => e.publishedAt)
          .map(e => new Date(e.publishedAt).getTime())
      )];
      const isActualRelist = uniqueTimestamps.length >= 2;

      if (dup.type === 'auction' && latestPrice < firstPrice && isActualRelist) {
        isPriceDrop = true;
        priceDropPercent = Math.round((1 - latestPrice / firstPrice) * 10000) / 100;
      }
    }

    const entryWithRoot = entries.find(e => e.rootId);
    const rootId = entryWithRoot ? entryWithRoot.rootId : dup.sourceIds.sort((a, b) => a - b)[0];

    // Cập nhật Duplicate
    const updateDoc = {
      entries,
      relistCount: new Set(entries.map(e => e.publishRound).filter(r => r > 0)).size || entries.length,
      firstPrice,
      latestPrice,
      isPriceDrop,
      priceDropPercent,
      rootId
    };
    if (prov) updateDoc.province = prov;
    if (org) updateDoc.organizer = org;

    bulkOps.push({
      updateOne: {
        filter: { _id: dup._id },
        update: { $set: updateDoc }
      }
    });

    // Cập nhật ngược lại AuctionNotice / OrgSelection
    const Model = dup.type === 'org' ? OrgSelection : AuctionNotice;
    for (const entry of entries) {
      noticeUpdates.push({
        model: Model,
        filter: { sourceId: entry.sourceId },
        update: {
          $set: {
            publishRound: entry.publishRound,
            publishRoundLabel: entry.publishRoundLabel || `Thông báo công khai lần ${entry.publishRound}`,
            rootId
          }
        }
      });
    }

    updatedCount++;
  }

  // 3. Thực thi bulkWrite cập nhật Duplicate
  if (bulkOps.length > 0) {
    console.log(`[Rebuild] Đang ghi ${bulkOps.length} nhóm Duplicate vào DB...`);
    await Duplicate.bulkWrite(bulkOps, { ordered: false });
  }

  // 4. Thực thi bulkWrite cập nhật AuctionNotice / OrgSelection theo lô
  if (noticeUpdates.length > 0) {
    console.log(`[Rebuild] Đang cập nhật ngược lại ${noticeUpdates.length} bài đăng (Auction/Org)...`);
    
    const auctionNoticeOps = [];
    const orgSelectionOps = [];

    for (const op of noticeUpdates) {
      const bulkOp = {
        updateOne: {
          filter: op.filter,
          update: op.update
        }
      };
      if (op.model === AuctionNotice) {
        auctionNoticeOps.push(bulkOp);
      } else {
        orgSelectionOps.push(bulkOp);
      }
    }

    if (auctionNoticeOps.length > 0) {
      const batchSize = 10000;
      for (let i = 0; i < auctionNoticeOps.length; i += batchSize) {
        const batch = auctionNoticeOps.slice(i, i + batchSize);
        await AuctionNotice.bulkWrite(batch, { ordered: false });
      }
    }
    if (orgSelectionOps.length > 0) {
      const batchSize = 10000;
      for (let i = 0; i < orgSelectionOps.length; i += batchSize) {
        const batch = orgSelectionOps.slice(i, i + batchSize);
        await OrgSelection.bulkWrite(batch, { ordered: false });
      }
    }
  }

  console.log(`✅ Rebuild hoàn thành: ${updatedCount} nhóm.`);
  await reportProgress(`Rebuild hoàn thành: đã cập nhật ${updatedCount} nhóm.`);
  return updatedCount;
}

/**
 * Cào detail cho tất cả bài trong nhóm duplicate mà chưa có detail.
 * Mỗi bài được cào độc lập từ trang gốc, KHÔNG ghi đè lẫn nhau.
 */
async function crawlDuplicateGroupsDetail(onProgress, shouldStop) {
  console.log('\n🔄 [Duplicate] Cào detail cho tất cả bài trong nhóm duplicate...');

  // Thu thập tất cả sourceIds từ các nhóm duplicate, tách theo type
  const dups = await Duplicate.find({}).select('sourceIds type').lean();
  const auctionIds = new Set();
  const orgIds = new Set();

  for (const dup of dups) {
    if (!dup.sourceIds) continue;
    const targetSet = dup.type === 'org' ? orgIds : auctionIds;
    for (const id of dup.sourceIds) targetSet.add(id);
  }

  let crawled = 0;
  let skipped = 0;
  let errors = 0;
  const concurrency = 1; // Luôn cào từng bài một để tránh anti-bot

  const reportProgress = async (message) => {
    if (typeof onProgress === 'function') await onProgress(message);
  };

  // ── Auction ──
  if (auctionIds.size > 0) {
    await reportProgress(`Đang cào detail cho ${auctionIds.size} bài auction trong nhóm duplicate...`);

    const allItems = await AuctionNotice.find({
      sourceId: { $in: [...auctionIds] },
    }).select('_id sourceId detailScraped properties initialPrice address name province sourceUrl').lean();

    const items = allItems.filter(isAuctionDetailIncomplete);

    skipped += auctionIds.size - items.length;
    console.log(`[Dup Detail Auction] ${auctionIds.size} tổng → ${items.length} chưa cào hoặc thiếu dữ liệu, ${auctionIds.size - items.length} đã bỏ qua`);

    for (let i = 0; i < items.length; i += concurrency) {
      if (typeof shouldStop === 'function' && shouldStop()) {
        await reportProgress('Đã dừng khi đang cào detail auction cho nhóm duplicate.');
        break;
      }

      const chunk = items.slice(i, i + concurrency);
      const results = await Promise.all(chunk.map(async (item) => {
        try {
          const { updates, files } = await fetchAuctionItemDetail(item.sourceId);
          updates.detailScraped = true;
          updates.lastCrawledAt = new Date();
          if (files && files.length > 0) updates.files = files;
          await AuctionNotice.updateOne({ _id: item._id }, { $set: updates });
          await delay(1500 + Math.random() * 1500); // Thêm delay tránh anti-bot
          return true;
        } catch (err) {
          console.error(`[Dup Detail Auction] ❌ ${item.sourceId}:`, err.message);
          return false;
        }
      }));

      crawled += results.filter(Boolean).length;
      errors += results.filter((r) => !r).length;

      if ((i + concurrency) % 30 === 0 || i + concurrency >= items.length) {
        await reportProgress(`Cào detail auction duplicate: ${crawled}/${items.length} (bỏ qua ${skipped}, lỗi ${errors})`);
      }
    }
  }

  // ── Org ──
  if (orgIds.size > 0) {
    await reportProgress(`Đang cào detail cho ${orgIds.size} bài org trong nhóm duplicate...`);

    const allItems = await OrgSelection.find({
      sourceId: { $in: [...orgIds] },
    }).select('_id sourceId detailScraped startingPrice province name sourceUrl').lean();

    const items = allItems.filter(isOrgDetailIncomplete);

    skipped += orgIds.size - items.length;
    console.log(`[Dup Detail Org] ${orgIds.size} tổng → ${items.length} chưa cào hoặc thiếu dữ liệu, ${orgIds.size - items.length} đã bỏ qua`);

    for (let i = 0; i < items.length; i += concurrency) {
      if (typeof shouldStop === 'function' && shouldStop()) {
        await reportProgress('Đã dừng khi đang cào detail org cho nhóm duplicate.');
        break;
      }

      const chunk = items.slice(i, i + concurrency);
      const results = await Promise.all(chunk.map(async (item) => {
        try {
          const { updates, files } = await fetchOrgItemDetail(item.sourceId);
          updates.detailScraped = true;
          updates.lastCrawledAt = new Date();
          if (files && files.length > 0) updates.files = files;
          await OrgSelection.updateOne({ _id: item._id }, { $set: updates });
          await delay(1500 + Math.random() * 1500); // Thêm delay tránh anti-bot
          return true;
        } catch (err) {
          console.error(`[Dup Detail Org] ❌ ${item.sourceId}:`, err.message);
          return false;
        }
      }));

      crawled += results.filter(Boolean).length;
      errors += results.filter((r) => !r).length;

      if ((i + concurrency) % 30 === 0 || i + concurrency >= items.length) {
        await reportProgress(`Cào detail org duplicate: ${crawled} đã cào (bỏ qua ${skipped}, lỗi ${errors})`);
      }
    }
  }

  await reportProgress(`Cào detail nhóm duplicate hoàn tất: ${crawled} cào, ${skipped} bỏ qua, ${errors} lỗi`);
  console.log(`✅ Cào detail duplicate: ${crawled} cào, ${skipped} bỏ qua, ${errors} lỗi`);
  return { crawled, skipped, errors };
}

// ═══════════════════════════════════════════════════════
// FUZZY MATCHING (JACCARD SIMILARITY > 70%)
// ═══════════════════════════════════════════════════════
const STOP_WORDS = new Set([
  'quyền', 'sử', 'dụng', 'đất', 'sở', 'hữu', 'nhà', 'và', 'tài', 'sản', 'khác', 'gắn', 'liền', 'với',
  'tại', 'địa', 'chỉ', 'số', 'thông', 'báo', 'việc', 'đấu', 'giá', 'danh', 'mục', 'đối', 'về', 'thực', 'hiện',
  'tạm', 'dừng', 'cuộc', 'thành', 'phố', 'tỉnh', 'huyện', 'quận', 'phường', 'xã', 'thị', 'trấn', 'nay', 'là',
  'của', 'ông', 'bà', 'công', 'ty', 'tnhh', 'cp', 'cổ', 'phần', 'kê', 'biên', 'bảo', 'đảm', 'thi', 'hành', 'án'
]);

function getWordSet(str) {
  if (!str) return new Set();
  const clean = str.toLowerCase().replace(/[,\.\(\):\-]/g, ' ').replace(/\s+/g, ' ').trim();
  return new Set(clean.split(' ').filter(w => w.length > 0 && !STOP_WORDS.has(w)));
}


function extractAssetItemsFromNotice(notice, type) {
  const items = [];
  const { extractPropertyIdentifiers, mapAssetType, removeDiacritics, extractCoreIdentity } = require('../utils/helpers');

  if (Array.isArray(notice.properties) && notice.properties.length > 0) {
    notice.properties.forEach((prop, index) => {
      const pName = prop.name || notice.name;
      if (!pName) return;
      const rawText = `${pName} ${prop.place || ''} ${prop.quality || ''} ${notice.address || ''}`;
      const cleanName = removeDiacritics(pName.toLowerCase()).trim();
      const ids = extractPropertyIdentifiers(rawText);

      const item = {
        noticeId: notice._id,
        sourceType: type,
        sourceId: notice.sourceId,
        itemIndex: index,
        name: pName,
        assetType: mapAssetType(notice.propertyTypeName, pName),
        rawText,
        normalizedText: cleanName,
        coreIdentity: extractCoreIdentity(pName),
        locationIdentity: `${ids.commune || ''} ${ids.district || ''} ${notice.province || ''}`.trim(),
        identifiers: ids,
        area: parseFloat(ids.area) || null,
        quantity: parseFloat(prop.amount) || 1,
        startingPrice: prop.startPrice || (type === 'auction' ? notice.initialPrice : notice.startingPrice),
        ownerName: ids.ownerName || notice.owner,
        auctionOrg: notice.organizer,
        province: notice.province,
        district: ids.district || notice.district,
        ward: ids.commune,
        attachmentTextUsed: false
      };
      item.blockingKeys = generateBlockingKeys(item);
      items.push(item);
    });
  } else {
    const pName = notice.name;
    if (!pName) return items;
    const rawText = `${pName} ${notice.address || ''} ${notice.shortDescription || ''}`;
    const cleanName = removeDiacritics(pName.toLowerCase()).trim();
    const ids = extractPropertyIdentifiers(rawText);

    const item = {
      noticeId: notice._id,
      sourceType: type,
      sourceId: notice.sourceId,
      itemIndex: 0,
      name: pName,
      assetType: mapAssetType(notice.propertyTypeName, pName),
      rawText,
      normalizedText: cleanName,
      coreIdentity: extractCoreIdentity(pName),
      locationIdentity: `${ids.commune || ''} ${ids.district || ''} ${notice.province || ''}`.trim(),
      identifiers: ids,
      area: parseFloat(ids.area) || null,
      quantity: 1,
      startingPrice: type === 'auction' ? notice.initialPrice : notice.startingPrice,
      ownerName: ids.ownerName || notice.owner,
      auctionOrg: notice.organizer,
      province: notice.province,
      district: ids.district || notice.district,
      ward: ids.commune,
      attachmentTextUsed: false
    };
    item.blockingKeys = generateBlockingKeys(item);
    items.push(item);
  }
  return items;
}

async function syncAllAssetItems(progressCallback) {
  if (progressCallback) await progressCallback('Đang dọn dẹp bảng AssetItem cũ và cấu trúc lại chỉ mục...');
  try {
    await AssetItem.collection.dropIndexes();
  } catch (err) {
    // Ignore if collection or index doesn't exist yet
  }
  await AssetItem.deleteMany({});
  await AssetItem.createIndexes();

  if (progressCallback) await progressCallback('Đang chuẩn bị trích xuất AssetItem từ AuctionNotice...');
  
  let totalItems = 0;
  let batchOps = [];
  const batchSize = 10000;

  const cursorAuction = AuctionNotice.find({ name: { $type: 'string', $ne: '' } }).lean().cursor();
  for await (const notice of cursorAuction) {
    const items = extractAssetItemsFromNotice(notice, 'auction');
    items.forEach(item => {
      batchOps.push({
        insertOne: {
          document: item
        }
      });
    });

    if (batchOps.length >= batchSize) {
      totalItems += batchOps.length;
      if (progressCallback) await progressCallback(`Đang ghi ${totalItems} AssetItem (Auctions)...`);
      try {
        await AssetItem.bulkWrite(batchOps, { ordered: false });
      } catch (err) {
        if (err.code === 11000) {
          const dupeCount = err.writeErrors?.length || 0;
          console.warn(`[SYNC] Bỏ qua ${dupeCount} AssetItem trùng key (Auctions batch).`);
        } else {
          throw err;
        }
      }
      batchOps = [];
    }
  }
  if (batchOps.length > 0) {
    totalItems += batchOps.length;
    try {
      await AssetItem.bulkWrite(batchOps, { ordered: false });
    } catch (err) {
      if (err.code === 11000) {
        const dupeCount = err.writeErrors?.length || 0;
        console.warn(`[SYNC] Bỏ qua ${dupeCount} AssetItem trùng key (Auctions cuối).`);
      } else {
        throw err;
      }
    }
    batchOps = [];
  }

  if (progressCallback) await progressCallback('Đang chuẩn bị trích xuất AssetItem từ OrgSelection...');
  const cursorOrg = OrgSelection.find({ name: { $type: 'string', $ne: '' } }).lean().cursor();
  for await (const notice of cursorOrg) {
    const items = extractAssetItemsFromNotice(notice, 'org');
    items.forEach(item => {
      batchOps.push({
        insertOne: {
          document: item
        }
      });
    });

    if (batchOps.length >= batchSize) {
      totalItems += batchOps.length;
      if (progressCallback) await progressCallback(`Đang ghi ${totalItems} AssetItem (Orgs)...`);
      try {
        await AssetItem.bulkWrite(batchOps, { ordered: false });
      } catch (err) {
        if (err.code === 11000) {
          const dupeCount = err.writeErrors?.length || 0;
          console.warn(`[SYNC] Bỏ qua ${dupeCount} AssetItem trùng key (Orgs batch).`);
        } else {
          throw err;
        }
      }
      batchOps = [];
    }
  }
  if (batchOps.length > 0) {
    totalItems += batchOps.length;
    try {
      await AssetItem.bulkWrite(batchOps, { ordered: false });
    } catch (err) {
      if (err.code === 11000) {
        const dupeCount = err.writeErrors?.length || 0;
        console.warn(`[SYNC] Bỏ qua ${dupeCount} AssetItem trùng key (Orgs cuối).`);
      } else {
        throw err;
      }
    }
  }

  if (progressCallback) await progressCallback(`Đã đồng bộ thành công ${totalItems} AssetItem vào Database.`);
}

async function getFuzzyNameGroups(Model, progressCallback, targetSourceIds = null) {
  const type = Model.modelName === 'AuctionNotice' ? 'auction' : 'org';
  if (progressCallback) await progressCallback(`Đang quét trùng lặp cho AssetItem (${type})...`);

  if (type === 'auction' && !targetSourceIds) {
    await PotentialDuplicate.deleteMany({});
  }

  const targetSet = targetSourceIds ? new Set(targetSourceIds) : null;
  const provinces = await AssetItem.distinct('province', { sourceType: type });
  const allFuzzyGroups = [];
  let potentialDupOps = [];

  for (let pIdx = 0; pIdx < provinces.length; pIdx++) {
    const prov = provinces[pIdx];
    const normalizedProv = normalizeProvince(prov);
    if (!normalizedProv) continue;

    const query = { sourceType: type, province: prov };
    const items = await AssetItem.find(query).lean();
    if (items.length < 2) continue;

    if (targetSet) {
      const hasAnyTarget = items.some(item => targetSet.has(item.sourceId));
      if (!hasAnyTarget) continue;
    }

    const msg = `Gom nhóm tương đồng: đang xử lý [${prov}] (${items.length} tài sản con) - Tiến độ: ${pIdx + 1}/${provinces.length} tỉnh/thành`;
    console.log(`[DUPLICATE SCAN] ${msg}`);
    if (progressCallback && (pIdx % 5 === 0 || pIdx === provinces.length - 1)) {
      await progressCallback(msg);
    }

    const blockingMap = new Map();
    items.forEach((item, idx) => {
      item.index = idx;
      if (Array.isArray(item.blockingKeys)) {
        if (item.blockingKeys.length > 0) {
          item.blockingKeys.forEach(key => {
            if (!blockingMap.has(key)) blockingMap.set(key, []);
            blockingMap.get(key).push(item);
          });
        }
      }
    });

    const parent = {};
    items.forEach(item => {
      parent[item._id.toString()] = item._id.toString();
    });

    const find = (id) => {
      if (parent[id] === id) return id;
      return parent[id] = find(parent[id]);
    };

    const union = (id1, id2) => {
      const r1 = find(id1);
      const r2 = find(id2);
      if (r1 !== r2) {
        parent[r1] = r2;
      }
    };

    let lastYield = Date.now();

    for (let i = 0; i < items.length; i++) {
      if (i % 100 === 0 && Date.now() - lastYield > 15) {
        await new Promise(resolve => setImmediate(resolve));
        lastYield = Date.now();
      }
      const itemA = items[i];
      const idAStr = itemA._id.toString();
      const hasTargetA = targetSet ? targetSet.has(itemA.sourceId) : true;

      const candidates = new Set();
      if (Array.isArray(itemA.blockingKeys)) {
        itemA.blockingKeys.forEach(key => {
          const list = blockingMap.get(key);
          if (list && list.length <= 150) {
            list.forEach(candidate => {
              if (candidate._id.toString() !== idAStr) {
                candidates.add(candidate);
              }
            });
          }
        });
      }

      for (const itemB of candidates) {
        if (itemB.index <= i) continue;

        const idBStr = itemB._id.toString();
        const hasTargetB = targetSet ? targetSet.has(itemB.sourceId) : true;

        if (targetSet && !hasTargetA && !hasTargetB) continue;

        const scoreRes = scoreAssetPair(itemA, itemB);

        if (scoreRes.decision === 'auto_group') {
          union(idAStr, idBStr);
        } else if (scoreRes.decision === 'review' && !targetSet) {
          potentialDupOps.push({
            insertOne: {
              document: {
                assetItemIdA: itemA._id,
                assetItemIdB: itemB._id,
                score: scoreRes.score,
                reasons: scoreRes.reasons,
                conflicts: scoreRes.conflicts,
                status: 'pending'
              }
            }
          });
          if (potentialDupOps.length >= 10000) {
            await PotentialDuplicate.bulkWrite(potentialDupOps, { ordered: false });
            potentialDupOps = [];
          }
        }
      }
    }

    const groupsMap = {};
    items.forEach(item => {
      const root = find(item._id.toString());
      if (!groupsMap[root]) groupsMap[root] = [];
      groupsMap[root].push(item.sourceId);
    });

    for (const root in groupsMap) {
      const ids = [...new Set(groupsMap[root])];
      if (ids.length >= 2) {
        if (ids.length > 150) {
          console.warn(`[DUPLICATE SCAN] Discarding extremely large group with size ${ids.length} (sample sourceId: ${ids[0]})`);
          continue;
        }
        allFuzzyGroups.push({ ids });
      }
    }
  }

  if (potentialDupOps.length > 0 && !targetSourceIds) {
    if (progressCallback) await progressCallback(`Đang lưu ${potentialDupOps.length} cặp nghi trùng lặp vào hàng chờ duyệt...`);
    await PotentialDuplicate.bulkWrite(potentialDupOps, { ordered: false });
  }

  return allFuzzyGroups;
}

/**
 * Cross-Group Merge: Gom các Duplicate records cùng tài sản vật lý nhưng bị tách riêng.
 * 
 * Vấn đề: Organizer đăng lại tài sản mỗi lần tạo cặp relatedIds mới (không link lại lần trước).
 * Kết quả: Cùng 1 tài sản nhưng có nhiều rootId khác nhau.
 * 
 * Giải pháp: Dùng AssetItem identifiers (plotNumber + mapSheet + district + ward + organizer)
 * làm key để merge các Duplicate records cùng key.
 */
async function mergeIdenticalAssetGroups(type, saveProgress, checkCancelled) {
  const label = type === 'auction' ? 'AuctionNotice' : 'OrgSelection';
  const Model = type === 'auction' ? AuctionNotice : OrgSelection;

  if (saveProgress) await saveProgress(`[Cross-Merge] Đang tải Duplicate records (${label})...`);

  // Phase 1: Convergence loop — lặp lại cho đến khi không còn merge được
  let totalPhase1Merged = 0;
  let totalPhase1Deleted = 0;
  const MAX_ITERATIONS = 5;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    const duplicates = await Duplicate.find({ type }).lean();
    if (duplicates.length === 0) break;

    if (iteration === 1) {
      if (saveProgress) await saveProgress(`[Cross-Merge] Đang phân tích ${duplicates.length} nhóm duplicate...`);
    }

    const allSourceIds = [...new Set(duplicates.flatMap(d => d.sourceIds))];

    const items = await AssetItem.find({
      sourceId: { $in: allSourceIds },
      sourceType: type
    }).select('sourceId identifiers district ward assetType province').lean();

    const notices = await Model.find({ sourceId: { $in: allSourceIds } })
      .select('sourceId organizer')
      .lean();
    const orgMap = {};
    for (const n of notices) orgMap[n.sourceId] = n.organizer || '';

    const sourceIdKeys = {};
    for (const item of items) {
      const ids = item.identifiers || {};
      if (!ids.plotNumber) continue;
      const key = [
        `p:${ids.plotNumber}`,
        `s:${ids.mapSheet || '?'}`,
        `d:${(item.district || '?').toLowerCase().trim()}`,
        `w:${(item.ward || '?').toLowerCase().trim()}`,
      ].join('|');
      if (!sourceIdKeys[item.sourceId]) sourceIdKeys[item.sourceId] = new Set();
      sourceIdKeys[item.sourceId].add(key);
    }

    const keyToDupIds = {};
    const sourceIdToDupIds = {};
    for (const dup of duplicates) {
      const orgs = dup.sourceIds.map(sid => orgMap[sid]).filter(Boolean);
      const mainOrg = orgs[0] || '';

      for (const sid of dup.sourceIds) {
        const keys = sourceIdKeys[sid];
        if (keys) {
          for (const key of keys) {
            const orgSlug = mainOrg.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
            const fullKey = `${key}|org:${orgSlug}`;
            if (!keyToDupIds[fullKey]) keyToDupIds[fullKey] = new Set();
            keyToDupIds[fullKey].add(dup._id.toString());
          }
        }

        if (!sourceIdToDupIds[sid]) sourceIdToDupIds[sid] = new Set();
        sourceIdToDupIds[sid].add(dup._id.toString());
      }
    }

    const dupById = {};
    for (const d of duplicates) dupById[d._id.toString()] = d;

    const parent = {};
    for (const d of duplicates) parent[d._id.toString()] = d._id.toString();
    const find = (id) => {
      if (parent[id] === id) return id;
      return parent[id] = find(parent[id]);
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    let mergeableKeys = 0;
    for (const [key, dupIdSet] of Object.entries(keyToDupIds)) {
      const dupIds = [...dupIdSet];
      if (dupIds.length < 2) continue;
      mergeableKeys++;
      for (let i = 1; i < dupIds.length; i++) union(dupIds[0], dupIds[i]);
    }

    let sourceIdOverlaps = 0;
    for (const [sid, dupIdSet] of Object.entries(sourceIdToDupIds)) {
      const dupIds = [...dupIdSet];
      if (dupIds.length < 2) continue;
      sourceIdOverlaps++;
      for (let i = 1; i < dupIds.length; i++) union(dupIds[0], dupIds[i]);
    }

    if (mergeableKeys === 0 && sourceIdOverlaps === 0) break;

    const groupsByRoot = {};
    for (const d of duplicates) {
      const root = find(d._id.toString());
      if (!groupsByRoot[root]) groupsByRoot[root] = [];
      groupsByRoot[root].push(d);
    }

    const toMerge = Object.values(groupsByRoot).filter(g => g.length > 1);
    if (toMerge.length === 0) break;

    if (saveProgress) await saveProgress(`[Cross-Merge] Iteration ${iteration}: merge ${toMerge.length} nhóm (${mergeableKeys} keys, ${sourceIdOverlaps} overlaps)...`);
    console.log(`[DUPLICATE SCAN] [Cross-Merge] Iteration ${iteration}: ${toMerge.length} groups to merge`);

    let mergedCount = 0;
    const bulkOps = [];
    const idsToDelete = [];

    for (const group of toMerge) {
      if (checkCancelled && checkCancelled()) break;
      const allIds = [...new Set(group.flatMap(d => d.sourceIds))].sort((a, b) => a - b);
      const keeper = group.reduce((best, d) => {
        const bestRoot = best.rootId || best.sourceIds[0];
        const dRoot = d.rootId || d.sourceIds[0];
        return (dRoot < bestRoot) ? d : best;
      });
      const keeperId = keeper._id.toString();
      const rootId = keeper.rootId || allIds[0];

      bulkOps.push({
        updateOne: {
          filter: { _id: keeper._id },
          update: { $set: { sourceIds: allIds, rootId, name: keeper.name } }
        }
      });
      for (const d of group) {
        if (d._id.toString() !== keeperId) idsToDelete.push(d._id);
      }
      mergedCount++;
    }

    if (bulkOps.length > 0) await Duplicate.bulkWrite(bulkOps, { ordered: false });
    if (idsToDelete.length > 0) await Duplicate.deleteMany({ _id: { $in: idsToDelete } });

    // Update rootId
    const updatedDups = await Duplicate.find({ type }).lean();
    const rootBulkOps = [];
    for (const dup of updatedDups) {
      if (!dup.rootId) continue;
      for (const sid of dup.sourceIds) {
        rootBulkOps.push({
          updateOne: {
            filter: { sourceId: sid },
            update: { $set: { rootId: dup.rootId } }
          }
        });
      }
    }

    if (rootBulkOps.length > 0) {
      for (let i = 0; i < rootBulkOps.length; i += 5000) {
        const batch = rootBulkOps.slice(i, i + 5000);
        await Model.bulkWrite(batch, { ordered: false });
      }
    }

    totalPhase1Merged += mergedCount;
    totalPhase1Deleted += idsToDelete.length;

    console.log(`[DUPLICATE SCAN] [Cross-Merge] Iteration ${iteration}: merged ${mergedCount}, deleted ${idsToDelete.length}`);
  }

  if (totalPhase1Merged > 0) {
    console.log(`[DUPLICATE SCAN] [Cross-Merge] Phase 1 total: merged ${totalPhase1Merged} groups, deleted ${totalPhase1Deleted} records`);
    if (saveProgress) await saveProgress(`[Cross-Merge] Phase 1 hoàn tất: merge ${totalPhase1Merged} nhóm, xóa ${totalPhase1Deleted} bản ghi trùng.`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Tạo Duplicate records cho các tin đơn lẻ (orphan) cùng identifier
  // ═══════════════════════════════════════════════════════════════════════════
  if (saveProgress) await saveProgress(`[Cross-Merge Phase 2] Đang tìm tin đơn lẻ chưa được gom nhóm...`);

  // Lấy lại duplicates sau merge phase 1
  const currentDups = await Duplicate.find({ type }).select('sourceIds').lean();
  const groupedSourceIds = new Set(currentDups.flatMap(d => d.sourceIds));

  // Tìm tất cả AssetItems KHÔNG nằm trong bất kỳ Duplicate record nào
  const allItems = await AssetItem.find({ sourceType: type })
    .select('sourceId identifiers district ward province')
    .lean();

  const orphanItems = allItems.filter(item => !groupedSourceIds.has(item.sourceId));

  // Group orphan items by identifier key + organizer
  const allOrphanSourceIds = [...new Set(orphanItems.map(i => i.sourceId))];
  let orphanOrgMap = {};
  if (allOrphanSourceIds.length > 0) {
    const orphanNotices = await Model.find({ sourceId: { $in: allOrphanSourceIds } })
      .select('sourceId organizer name')
      .lean();
    for (const n of orphanNotices) {
      orphanOrgMap[n.sourceId] = { organizer: n.organizer || '', name: n.name || '' };
    }
  }

  const orphanKeyGroups = {};
  for (const item of orphanItems) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;

    const org = orphanOrgMap[item.sourceId]?.organizer || '';
    const orgSlug = org.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');

    const key = [
      `p:${ids.plotNumber}`,
      `s:${ids.mapSheet || '?'}`,
      `d:${(item.district || '?').toLowerCase().trim()}`,
      `w:${(item.ward || '?').toLowerCase().trim()}`,
      `org:${orgSlug}`,
    ].join('|');

    if (!orphanKeyGroups[key]) orphanKeyGroups[key] = new Set();
    orphanKeyGroups[key].add(item.sourceId);
  }

  // Cũng check orphan items có khớp với Duplicate đã tồn tại không
  // (trường hợp tin đơn lẻ có cùng identifier với 1 nhóm đã gom)
  const existingDupKeyMap = {}; // key → dupId
  const reloadedDups = await Duplicate.find({ type }).lean();

  // Dùng Map thay vì filter() để O(1) lookup
  const groupedItems = allItems.filter(item => groupedSourceIds.has(item.sourceId));
  const itemsBySourceId = new Map();
  for (const item of groupedItems) {
    if (!itemsBySourceId.has(item.sourceId)) itemsBySourceId.set(item.sourceId, []);
    itemsBySourceId.get(item.sourceId).push(item);
  }

  // Lấy lại orgMap
  const reloadNotices = await Model.find({ sourceId: { $in: [...groupedSourceIds].slice(0, 500000) } })
    .select('sourceId organizer')
    .lean();
  const reloadOrgMap = {};
  for (const n of reloadNotices) reloadOrgMap[n.sourceId] = n.organizer || '';

  for (const dup of reloadedDups) {
    const dupOrg = dup.sourceIds.map(sid => reloadOrgMap[sid]).filter(Boolean)[0] || '';
    const dupOrgSlug = dupOrg.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const sid of dup.sourceIds) {
      const matchItems = itemsBySourceId.get(sid);
      if (!matchItems) continue;
      for (const item of matchItems) {
        const ids = item.identifiers || {};
        if (!ids.plotNumber) continue;
        const key = [
          `p:${ids.plotNumber}`,
          `s:${ids.mapSheet || '?'}`,
          `d:${(item.district || '?').toLowerCase().trim()}`,
          `w:${(item.ward || '?').toLowerCase().trim()}`,
          `org:${dupOrgSlug}`,
        ].join('|');

        if (!existingDupKeyMap[key]) existingDupKeyMap[key] = dup;
      }
    }
  }

  let phase2Created = 0;
  let phase2Merged = 0;
  const phase2BulkOps = [];

  for (const [key, sourceIdSet] of Object.entries(orphanKeyGroups)) {
    const sourceIds = [...sourceIdSet].sort((a, b) => a - b);
    if (sourceIds.length < 2 && !existingDupKeyMap[key]) continue;

    const existingDup = existingDupKeyMap[key];

    if (existingDup) {
      // Merge orphans vào Duplicate record đã tồn tại
      const mergedIds = [...new Set([...existingDup.sourceIds, ...sourceIds])].sort((a, b) => a - b);
      phase2BulkOps.push({
        updateOne: {
          filter: { _id: existingDup._id },
          update: { $set: { sourceIds: mergedIds } }
        }
      });

      // Update rootId cho orphan notices
      for (const sid of sourceIds) {
        phase2BulkOps.push({
          updateOne: {
            filter: { sourceId: sid },
            update: { $set: { rootId: existingDup.rootId } }
          }
        });
      }
      phase2Merged++;
    } else if (sourceIds.length >= 2) {
      // Tạo Duplicate record mới
      const rootId = sourceIds[0];
      const name = orphanOrgMap[sourceIds[0]]?.name || '';
      
      phase2BulkOps.push({
        insertOne: {
          document: {
            type,
            name,
            sourceIds,
            rootId,
            relistCount: sourceIds.length,
            entries: [],
          }
        }
      });

      // Update rootId cho notices
      for (const sid of sourceIds) {
        await Model.updateOne({ sourceId: sid }, { $set: { rootId } });
      }
      phase2Created++;
    }
  }

  if (phase2BulkOps.length > 0) {
    // Tách Duplicate operations và Model operations
    const dupOps = phase2BulkOps.filter(op => op.insertOne || (op.updateOne && !op.updateOne.filter.sourceId));
    const modelOps = phase2BulkOps.filter(op => op.updateOne && op.updateOne.filter.sourceId);

    if (dupOps.length > 0) {
      await Duplicate.bulkWrite(dupOps, { ordered: false });
    }
    if (modelOps.length > 0) {
      for (let i = 0; i < modelOps.length; i += 5000) {
        await Model.bulkWrite(modelOps.slice(i, i + 5000), { ordered: false });
      }
    }
  }

  console.log(`[DUPLICATE SCAN] [Cross-Merge Phase 2] Created ${phase2Created} new groups, merged ${phase2Merged} orphans into existing groups`);
  if (saveProgress) await saveProgress(`[Cross-Merge Phase 2] Tạo ${phase2Created} nhóm mới, gom ${phase2Merged} tin đơn lẻ vào nhóm đã có.`);
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

  const progressEvery = 1000;

  const saveProgress = async (message) => {
    if (message) {
      console.log(`[DUPLICATE SCAN] ${message}`); // ADDED CONSOLE LOG SO USER SEES PROGRESS
      const currentMessages = Array.isArray(log.errorMessages) ? log.errorMessages : [];
      log.errorMessages = [...currentMessages.slice(-4), message];
    }
    try {
      await CrawlLog.updateOne({ _id: log._id }, {
        $set: {
          errorMessages: log.errorMessages,
          status: log.status,
          finishedAt: log.finishedAt,
          itemsUpdated: log.itemsUpdated,
          itemsSkipped: log.itemsSkipped,
          pagesProcessed: log.pagesProcessed,
        }
      });
    } catch (e) {
      console.error('Lỗi update log:', e.message);
    }
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
    try {
      await CrawlLog.updateOne({ _id: log._id }, {
        $set: {
          errorMessages: log.errorMessages,
          status: log.status,
          finishedAt: log.finishedAt,
        }
      });
    } catch (e) { }

    const cancelError = new Error(cancelMessage);
    cancelError.code = 'DUPLICATE_SCAN_CANCELLED';
    throw cancelError;
  };

  const processTypeGroups = async (type, label, rawItems, nameGroups) => {
    await ensureNotCancelled(`Đã dừng trước khi xử lý ${label}.`);
    await saveProgress(`Đang gom cụm ${label} theo relatedIds...`);
    const relatedGroups = await buildGraphGroups(rawItems, (item) => item.relatedIds);

    await ensureNotCancelled(`Đã dừng khi đang gom cụm ${label}.`);
    await saveProgress(`Đang gom cụm ${label} theo tên (${nameGroups.length} nhóm tên)...`);
    const normalizedNameGroups = nameGroups
      .map((group) => Array.isArray(group.ids) ? [...new Set(group.ids)].sort((a, b) => a - b) : [])
      .filter((group) => group.length >= 2);

    const multiAssetItems = await AssetItem.aggregate([
      { $group: { _id: "$sourceId", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    const multiAssetSet = new Set(multiAssetItems.map(item => item._id));

    const mergedGroups = mergeDuplicateGroups([relatedGroups, normalizedNameGroups], multiAssetSet)
      .filter((group) => {
        if (group.length > 150) {
          console.warn(`[DUPLICATE SCAN] Warning: Discarding merged group with size ${group.length} to prevent generic title clustering.`);
          return false;
        }
        return true;
      });
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
    const operations = buildDuplicateBulkOperations(mergedGroups, sourceMap, type, multiAssetSet);

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
    await saveProgress('Đang xoá dữ liệu duplicate cũ để tạo mới hoàn toàn...');
    await Duplicate.deleteMany({});
    await AuctionNotice.updateMany({}, { $unset: { rootId: "", publishRound: "", publishRoundLabel: "" } });
    await OrgSelection.updateMany({}, { $unset: { rootId: "", publishRound: "", publishRoundLabel: "" } });

    await saveProgress('Đang trích xuất AssetItem từ cơ sở dữ liệu...');
    await syncAllAssetItems(saveProgress);

    await saveProgress('Đang tải dữ liệu AuctionNotice...');
    const auctions = await AuctionNotice.find({})
      .select('sourceId relatedIds name province address')
      .maxTimeMS(0)
      .lean();
    await saveProgress(`Đang gom nhóm AuctionNotice (${auctions.length} bài)...`);
    const nameGroupsAuction = await getFuzzyNameGroups(AuctionNotice, saveProgress);
    await processTypeGroups('auction', 'AuctionNotice', auctions, nameGroupsAuction);

    await saveProgress('Đang tải dữ liệu OrgSelection...');
    const orgs = await OrgSelection.find({})
      .select('sourceId relatedIds name province address')
      .maxTimeMS(0)
      .lean();
    await saveProgress(`Đang gom nhóm OrgSelection (${orgs.length} bài)...`);
    const nameGroupsOrg = await getFuzzyNameGroups(OrgSelection, saveProgress);
    await processTypeGroups('org', 'OrgSelection', orgs, nameGroupsOrg);

    // Cross-Group Merge: Gom các Duplicate records cùng tài sản vật lý nhưng bị tách riêng
    await ensureNotCancelled('Đã dừng trước khi chạy Cross-Group Merge.');
    await saveProgress('[Cross-Merge] Đang gom các nhóm duplicate bị tách riêng (AuctionNotice)...');
    await mergeIdenticalAssetGroups('auction', saveProgress, () => duplicateScanState.cancelRequested);
    
    await ensureNotCancelled('Đã dừng trước khi chạy Cross-Group Merge OrgSelection.');
    await saveProgress('[Cross-Merge] Đang gom các nhóm duplicate bị tách riêng (OrgSelection)...');
    await mergeIdenticalAssetGroups('org', saveProgress, () => duplicateScanState.cancelRequested);

    await ensureNotCancelled('Đã dừng trước khi khôi phục duplicate bị thiếu.');
    if (!duplicateScanState.skipDetailCrawl) {
      await saveProgress('Đang khôi phục duplicate bị thiếu...');
      await recoverMissingDuplicates(saveProgress, () => duplicateScanState.cancelRequested);
    } else {
      await saveProgress('Đã bỏ qua bước khôi phục dữ liệu bị thiếu (theo yêu cầu).');
    }

    await ensureNotCancelled('Đã dừng trước khi cào detail cho nhóm duplicate.');
    if (!duplicateScanState.skipDetailCrawl) {
      await saveProgress('Đang cào detail cho các bài trong nhóm duplicate...');
      await crawlDuplicateGroupsDetail(saveProgress, () => duplicateScanState.cancelRequested);
    } else {
      await saveProgress('Đã bỏ qua bước cào detail (theo yêu cầu).');
    }

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
      try {
        await CrawlLog.updateOne({ _id: log._id }, {
          $set: {
            errorMessages: log.errorMessages,
            status: log.status,
            finishedAt: log.finishedAt,
          }
        });
      } catch (e) { }
    }
    console.error('[TRIGGER] Error in duplicate scan:', err);
    throw err;
  } finally {
    resetDuplicateScanState();
  }
}

async function runOrganizerDuplicateScan(organizerName, existingLog = null) {
  if (!organizerName) throw new Error('Organizer name is required');
  
  duplicateScanState.isRunning = true;
  duplicateScanState.cancelRequested = false;

  const log = existingLog || await CrawlLog.create({
    type: 'organizer_duplicate_scan',
    startedAt: new Date(),
    status: 'running',
    itemsUpdated: 0,
    itemsSkipped: 0,
    pagesProcessed: 0,
    errorMessages: [`Bắt đầu quét duplicate cho đơn vị: ${organizerName}`],
  });

  const progressEvery = 1000;

  const saveProgress = async (message) => {
    if (message) {
      console.log(`[ORG DUPLICATE SCAN] ${message}`);
    }
    try {
      await CrawlLog.updateOne({ _id: log._id }, {
        $set: {
          status: log.status,
          finishedAt: log.finishedAt,
          itemsUpdated: log.itemsUpdated,
          itemsSkipped: log.itemsSkipped,
          pagesProcessed: log.pagesProcessed,
          updatedAt: new Date()
        },
        $push: {
          errorMessages: { $each: message ? [message] : [], $slice: -20 }
        }
      });
    } catch (e) { }
  };
  const ensureNotCancelled = async (message) => {
    if (!duplicateScanState.cancelRequested) return;
    log.status = 'failed';
    log.finishedAt = new Date();
    const cancelMessage = message || 'Tiến trình đã được dừng thủ công.';
    log.errorMessages = [...(log.errorMessages || []).slice(-4), cancelMessage];
    await CrawlLog.updateOne({ _id: log._id }, { $set: { errorMessages: log.errorMessages, status: log.status, finishedAt: log.finishedAt } });
    throw new Error(cancelMessage);
  };

  try {
    // 1. Xoá các bản ghi duplicate cũ của riêng đơn vị này để tạo mới
    const orgRegex = new RegExp(organizerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    console.log(`\n[ORG DUPLICATE SCAN] 🚀 Bắt đầu quét cho: ${organizerName}`);
    await saveProgress('Đang xoá dữ liệu duplicate cũ của đơn vị này...');
    const deleteRes = await Duplicate.deleteMany({ organizer: orgRegex });
    console.log(`[ORG DUPLICATE SCAN] 🗑️ Đã xoá ${deleteRes.deletedCount} nhóm cũ.`);

    // 2. Lấy TOÀN BỘ dữ liệu AuctionNotice để có thể gộp chéo đơn vị
    await saveProgress('Đang tải toàn bộ dữ liệu AuctionNotice để đối chiếu chéo...');
    const allAuctions = await AuctionNotice.find({ name: { $type: 'string', $ne: '' } })
      .select('sourceId name province relatedIds organizer')
      .maxTimeMS(0)
      .lean();
    
    // Tìm các ID thuộc về đơn vị này
    const orgAuctionIds = new Set(
      allAuctions.filter(a => orgRegex.test(a.organizer)).map(a => a.sourceId)
    );

    console.log(`[ORG DUPLICATE SCAN] 📥 Đã tải ${allAuctions.length} tài sản từ DB (${orgAuctionIds.size} thuộc đơn vị này).`);
    log.itemsSkipped = orgAuctionIds.size; // Lưu tổng số tài sản vào field itemsSkipped tạm thời để user thấy quy mô
    await saveProgress(`Đã tải ${orgAuctionIds.size} tài sản (đối chiếu chéo với ${allAuctions.length} tài sản hệ thống).`);

    if (orgAuctionIds.size === 0) {
      log.status = 'completed';
      log.finishedAt = new Date();
      await saveProgress('Đơn vị chưa có bài đăng nào, không cần quét trùng lặp.');
      console.log(`[ORG DUPLICATE SCAN] ⏭️ Kết thúc sớm (0 bản ghi).`);
      return { success: true, logId: log._id };
    }

    // 3. Gom nhóm theo relatedIds (Toàn hệ thống)
    await saveProgress('Gom nhóm theo relatedIds...');
    const allRelatedGroups = await buildGraphGroups(allAuctions, (item) => item.relatedIds);
    // Chỉ giữ lại các nhóm có liên quan đến đơn vị này
    const relatedGroups = allRelatedGroups.filter(g => Array.isArray(g) && g.some(id => orgAuctionIds.has(id)));
    console.log(`[ORG DUPLICATE SCAN] 🔗 Tìm thấy ${relatedGroups.length} nhóm theo relatedIds có chứa tài sản của đơn vị.`);

    // 4. Gom nhóm theo tên (fuzzy) (Toàn hệ thống)
    await saveProgress('Gom nhóm theo tên tương đồng...');
    const allNameGroups = await getFuzzyNameGroupsFiltered(allAuctions, saveProgress, orgAuctionIds);
    // Chỉ giữ lại các nhóm có liên quan đến đơn vị này
    const nameGroups = allNameGroups.filter(g => g.ids.some(id => orgAuctionIds.has(id)));
    console.log(`[ORG DUPLICATE SCAN] 🏷️ Tìm thấy ${nameGroups.length} nhóm theo tên tương đồng có chứa tài sản của đơn vị.`);

    const multiAssetItems = await AssetItem.aggregate([
      { $group: { _id: "$sourceId", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    const multiAssetSet = new Set(multiAssetItems.map(item => item._id));

    // 5. Merge và cập nhật
    const mergedGroups = mergeDuplicateGroups([relatedGroups, nameGroups.map(g => g.ids)], multiAssetSet);
    console.log(`[ORG DUPLICATE SCAN] 📦 Sau khi gộp: ${mergedGroups.length} nhóm trùng lặp.`);

    if (mergedGroups.length === 0) {
      log.status = 'completed';
      log.finishedAt = new Date();
      await saveProgress('Không tìm thấy bài đăng trùng lặp nào cho đơn vị này.');
      console.log(`[ORG DUPLICATE SCAN] ✅ Không có trùng lặp.`);
      return { success: true, logId: log._id };
    }

    await saveProgress(`Đang cập nhật ${mergedGroups.length} nhóm trùng lặp...`);
    const allSourceIds = [...new Set(mergedGroups.flat())];
    const sourceMap = await fetchDuplicateSourceMap('auction', allSourceIds);
    
    // Đảm bảo các nhóm mới tạo có đầy đủ thông tin organizer từ tham số đầu vào
    const operations = buildDuplicateBulkOperations(mergedGroups, sourceMap, 'auction', multiAssetSet);
    operations.forEach(op => {
      if (op.updateOne.update.$set) {
        op.updateOne.update.$set.organizer = organizerName;
      }
    });

    // 5. Xoá tất cả các nhóm trùng lặp cũ có chứa bất kỳ ID nào trong nhóm mới
    // để tránh tình trạng ID bị trùng lặp ở nhiều nhóm khác nhau (Overlapping groups)
    const allSourceIds = [...new Set(mergedGroups.flat())];
    await saveProgress('Đang dọn dẹp các nhóm trùng lặp cũ để tránh chồng lấn...');
    const existingOverlaps = await Duplicate.find({
      type: 'auction',
      sourceIds: { $in: allSourceIds }
    }).select('_id').lean();
    if (existingOverlaps.length > 0) {
      const idsToDelete = existingOverlaps.map(d => d._id);
      await Duplicate.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`[ORG DUPLICATE SCAN] 🗑️ Đã xoá thêm ${idsToDelete.length} nhóm chồng lấn từ đơn vị khác hoặc null.`);
    }

    for (let index = 0; index < operations.length; index += progressEvery) {
      await ensureNotCancelled();
      const batch = operations.slice(index, index + progressEvery);
      await Duplicate.bulkWrite(batch, { ordered: false });
      log.itemsUpdated += batch.length;
      await saveProgress(`Đã cập nhật ${Math.min(index + batch.length, operations.length)}/${operations.length} nhóm`);
    }

    // 6. Rebuild entries (giá, ngày...) cho các nhóm vừa tạo bằng Bulk Operation cực nhanh
    await saveProgress('Đang cập nhật thông tin chi tiết (giá, ngày...) cho các nhóm...');
    console.log(`[ORG DUPLICATE SCAN] 🛠️ Đang cập nhật chi tiết cho ${mergedGroups.length} nhóm...`);
    
    await rebuildAllDuplicateEntries(
      () => duplicateScanState.cancelRequested,
      saveProgress,
      { type: 'auction', organizer: orgRegex }
    );

    log.status = 'completed';
    log.finishedAt = new Date();
    await saveProgress('Quét trùng lặp đơn vị hoàn tất.');
    console.log(`[ORG DUPLICATE SCAN] ✨ Hoàn tất!`);
    return { success: true, logId: log._id };
  } catch (err) {
    log.status = 'failed';
    log.finishedAt = new Date();
    log.errorMessages = [...(log.errorMessages || []), err.message];
    await CrawlLog.updateOne({ _id: log._id }, { $set: { status: log.status, finishedAt: log.finishedAt, errorMessages: log.errorMessages } });
    throw err;
  } finally {
    resetDuplicateScanState();
  }
}

/**
 * Version của getFuzzyNameGroups nhưng chạy trên dữ liệu đã được nạp sẵn thay vì query DB lại
 */
async function getFuzzyNameGroupsFiltered(items, progressCallback, targetSourceIds = null) {
  return getFuzzyNameGroups(AuctionNotice, progressCallback, targetSourceIds);
}

function isOrgDetailIncomplete(item) {
  return item.detailScraped !== true
    || !item.startingPrice
    || !item.province
    || !item.name
    || !item.sourceUrl;
}

async function runFixMissingData() {
  const log = await CrawlLog.create({
    type: 'fix_missing_data',
    status: 'running',
    itemsUpdated: 0,
    itemsSkipped: 0,
    pagesProcessed: 0,
    errorMessages: []
  });

  try {
    const auctionCursor = AuctionNotice.find().lean().cursor();
    let auctionCount = 0;
    for await (const doc of auctionCursor) {
      if (isAuctionDetailIncomplete(doc)) {
        try {
          const { updates, files } = await fetchAuctionItemDetail(doc.sourceId);
          if (updates && Object.keys(updates).length > 0) {
            updates.detailScraped = true;
            updates.lastCrawledAt = new Date();
            if (files && files.length > 0) updates.files = files;
            await AuctionNotice.updateOne({ _id: doc._id }, { $set: updates });
            
            const currentName = updates.name || doc.name;
            if (currentName) {
               const exactNameRelatedIds = await searchDuplicatesByFuzzyName(doc.sourceId, currentName, 'auction', false, updates.province || doc.province);
               const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];
               if (allRelatedIds.length > 0) {
                 await handleDuplicate(doc.sourceId, currentName, allRelatedIds, 'auction');
               }
            }
            log.itemsUpdated += 1;
          } else {
            log.itemsSkipped += 1;
          }
        } catch (err) {
          log.errorMessages.push(`[Auction #${doc.sourceId}] ${err.message}`);
        }
        
        await delay(1500 + Math.random() * 1500); // Thêm delay tránh anti-bot
        auctionCount++;
        if (auctionCount % 10 === 0) {
          await CrawlLog.updateOne({ _id: log._id }, { $set: { itemsUpdated: log.itemsUpdated, itemsSkipped: log.itemsSkipped, errorMessages: log.errorMessages } });
        }
      }
    }

    const orgCursor = OrgSelection.find().lean().cursor();
    let orgCount = 0;
    for await (const doc of orgCursor) {
      if (isOrgDetailIncomplete(doc)) {
        try {
          const { updates, files } = await fetchOrgItemDetail(doc.sourceId);
          if (updates && Object.keys(updates).length > 0) {
            updates.detailScraped = true;
            updates.lastCrawledAt = new Date();
            if (files && files.length > 0) updates.files = files;
            await OrgSelection.updateOne({ _id: doc._id }, { $set: updates });
            
            const currentName = updates.name || doc.name;
            if (currentName) {
               const exactNameRelatedIds = await searchDuplicatesByFuzzyName(doc.sourceId, currentName, 'org', false, updates.province || doc.province);
               const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];
               if (allRelatedIds.length > 0) {
                 await handleDuplicate(doc.sourceId, currentName, allRelatedIds, 'org');
               }
            }
            log.itemsUpdated += 1;
          } else {
            log.itemsSkipped += 1;
          }
        } catch (err) {
          log.errorMessages.push(`[Org #${doc.sourceId}] ${err.message}`);
        }
        
        await delay(1500 + Math.random() * 1500); // Thêm delay tránh anti-bot
        orgCount++;
        if (orgCount % 10 === 0) {
          await CrawlLog.updateOne({ _id: log._id }, { $set: { itemsUpdated: log.itemsUpdated, itemsSkipped: log.itemsSkipped, errorMessages: log.errorMessages } });
        }
      }
    }

    log.status = 'completed';
    log.finishedAt = new Date();
    await log.save();
  } catch (err) {
    log.status = 'failed';
    log.finishedAt = new Date();
    log.errorMessages.push(err.message);
    await log.save();
  }
}


module.exports = {
  fetchAuctionItemDetail,
  fetchOrgItemDetail,
  fetchPublishHistory,
  handleDuplicate,
  searchDuplicatesByFuzzyName,
  getFuzzyNameGroupsFiltered,
  buildDuplicateEntries,
  summarizeDuplicateEntries,
  recrawlMissingAuctionDetails,
  crawlDetails,
  crawlOrgDetails,
  recoverMissingDuplicates,
  rebuildAllDuplicateEntries,
  crawlDuplicateGroupsDetail,
  runFullDuplicateScan,
  runOrganizerDuplicateScan,
  requestDuplicateScanCancel,
  getDuplicateScanState,
  setSkipDetailCrawl,
  runFixMissingData,
  extractAssetItemsFromNotice,
  syncAllAssetItems,
};

