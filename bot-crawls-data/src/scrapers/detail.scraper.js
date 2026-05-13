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
const { delay, slugify, extractProvince, normalizeProvince, getBigrams, jaccardSimilarity, overlapSimilarity, extractCoreIdentity, getNumberTokens, extractPropertyIdentifiers, hasConflictingIdentifiers, hasMatchingStrongIdentifiers } = require('../utils/helpers');

const duplicateScanState = {
  isRunning: false,
  cancelRequested: false,
  skipDetailCrawl: false, // Thêm cờ để bỏ qua cào dữ liệu khi bị block
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
  dup.relistCount = entries.length;

  // Lấy province và organizer từ các entry
  const Model = type === 'org' ? OrgSelection : AuctionNotice;
  const dbItems = await Model.find({ sourceId: { $in: dup.sourceIds } }).select('province organizer').lean();
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

function isAuctionDetailIncomplete(item) {
  return item.detailScraped !== true
    || !Array.isArray(item.properties)
    || item.properties.length === 0
    || !item.initialPrice
    || !item.currentPrice
    || !item.address
    || !item.organizer
    || !item.owner;
}

async function recrawlMissingAuctionDetails(sourceIds, options = {}) {
  const ids = [...new Set((sourceIds || []).map((id) => Number(id)).filter(Boolean))];
  if (ids.length === 0) return { updated: 0, skipped: 0, errors: 0 };

  const items = await AuctionNotice.find({ sourceId: { $in: ids } })
    .select('_id sourceId detailScraped properties initialPrice currentPrice address organizer owner')
    .lean();
  const itemBySourceId = new Map(items.map((item) => [item.sourceId, item]));
  const force = options.force === true;
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || config.crawl.concurrency || 30, 100));
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
  const adjacency = new Map();

  const ensureNode = (id) => {
    if (!adjacency.has(id)) {
      adjacency.set(id, new Set());
    }
  };

  for (const groups of groupSets) {
    for (const group of groups) {
      if (!Array.isArray(group) || group.length < 2) continue;

      for (let i = 0; i < group.length; i++) {
        ensureNode(group[i]);
        if (i > 0) {
          adjacency.get(group[i]).add(group[i - 1]);
          adjacency.get(group[i - 1]).add(group[i]);
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
      mergedGroups.push(group.sort((a, b) => a - b));
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
            province: items.find((item) => item.province)?.province || null,
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
async function searchDuplicatesByFuzzyName(sourceId, name, type) {
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

    // 1. Tìm trên API gốc (chính xác)
    let apiCandidates = [];
    try {
      const res = await fetchAPI(endpoint, payload);
      if (res && res.items && res.items.length >= 2 && res.rowCount < 100) {
        res.items.forEach(i => {
          if (i.id && i.id !== sourceId) {
            apiCandidates.push({
              sourceId: i.id,
              name: i.nameAsset || i.name || i.assetName || ''
            });
          }
        });
      }
    } catch (apiErr) {
      console.error(`[API Search] Lỗi khi tìm kiếm ${sourceId}:`, apiErr.message);
    }

    // 2. Fuzzy match từ local DB (giống 70-80%)
    const Model = type === 'auction' ? AuctionNotice : OrgSelection;
    const targetProvince = extractProvince(name);
    const dbQuery = { $text: { $search: name } };
    if (targetProvince) {
      if (targetProvince === 'TP. Hồ Chí Minh') {
        dbQuery.province = { $in: ['TP. Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'TP Hồ Chí Minh', 'Hồ Chí Minh'] };
      } else {
        dbQuery.province = targetProvince;
      }
    }

    const dbCandidates = await Model.find(
      dbQuery,
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(300)
      .select('sourceId name')
      .lean();

    // 3. Fallback bằng regex nếu có số cụ thể (khắc phục lỗi $text search bỏ sót)
    const targetNumbers = getNumberTokens(name);
    const targetIdentifiers = extractPropertyIdentifiers(name);
    let dbCandidatesRegex = [];
    
    // Nếu có quá nhiều số (>10), ta chỉ lọc lấy các số "quan trọng" để search regex
    let searchNumbers = targetNumbers;
    if (targetNumbers.length > 10) {
      searchNumbers = [];
      if (targetIdentifiers.plotNumber) searchNumbers.push(targetIdentifiers.plotNumber);
      if (targetIdentifiers.mapSheet) searchNumbers.push(targetIdentifiers.mapSheet);
      if (targetIdentifiers.houseNumber) searchNumbers.push(targetIdentifiers.houseNumber);
      if (targetIdentifiers.certificateNumber) searchNumbers.push(targetIdentifiers.certificateNumber);
      if (targetIdentifiers.licensePlate) searchNumbers.push(targetIdentifiers.licensePlate);
      
      // Thêm các số có định dạng đặc biệt (chứa / hoặc - hoặc dài)
      const specialNums = targetNumbers.filter(n => n.includes('/') || n.includes('-') || n.length >= 5);
      searchNumbers = [...new Set([...searchNumbers, ...specialNums])].slice(0, 10);
    }

    if (searchNumbers.length > 0) {
      const regexQueries = searchNumbers.map(num => ({ name: { $regex: "(^|\\s)" + num + "(\\s|$|\\.|,|\\)|/)", $options: 'i' } }));
      const regexDbQuery = { $or: regexQueries };
      if (targetProvince) {
        if (targetProvince === 'TP. Hồ Chí Minh') {
          regexDbQuery.province = { $in: ['TP. Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'TP Hồ Chí Minh', 'Hồ Chí Minh'] };
        } else {
          regexDbQuery.province = targetProvince;
        }
      }
      
      dbCandidatesRegex = await Model.find(regexDbQuery)
        .limit(300)
        .select('sourceId name')
        .lean();
    }

    // 4. Tìm kiếm chính xác theo Plot/Map hoặc GCN (nếu có)
    let dbCandidatesStrong = [];
    if ((targetIdentifiers.plotNumber && targetIdentifiers.mapSheet) || targetIdentifiers.certificateNumber || targetIdentifiers.licensePlate) {
        const strongQueries = [];
        if (targetIdentifiers.plotNumber && targetIdentifiers.mapSheet) {
            // Tìm các bản ghi có chứa cả plot và map trong name
            strongQueries.push({
                $and: [
                    { name: { $regex: "(^|\\s)" + targetIdentifiers.plotNumber + "(\\s|$|\\.|,|\\)|/)", $options: 'i' } },
                    { name: { $regex: "(^|\\s)" + targetIdentifiers.mapSheet + "(\\s|$|\\.|,|\\)|/)", $options: 'i' } }
                ]
            });
        }
        if (targetIdentifiers.certificateNumber) {
            strongQueries.push({ name: { $regex: targetIdentifiers.certificateNumber, $options: 'i' } });
        }
        if (targetIdentifiers.licensePlate) {
            strongQueries.push({ name: { $regex: targetIdentifiers.licensePlate, $options: 'i' } });
        }

        if (strongQueries.length > 0) {
            const strongDbQuery = { $or: strongQueries };
            if (targetProvince) {
                if (targetProvince === 'TP. Hồ Chí Minh') {
                    strongDbQuery.province = { $in: ['TP. Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'TP Hồ Chí Minh', 'Hồ Chí Minh'] };
                } else {
                    strongDbQuery.province = targetProvince;
                }
            }
            dbCandidatesStrong = await Model.find(strongDbQuery).limit(100).select('sourceId name').lean();
        }
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
      if (targetIdentifiers.apartment && targetIdentifiers.apartment === candidateIdentifiers.apartment && (coreSim >= 0.20 || ovSim >= 0.33)) {
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
        const exactNameRelatedIds = await searchDuplicatesByFuzzyName(item.sourceId, item.name, 'auction');
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

    const Model = dup.type === 'org' ? OrgSelection : AuctionNotice;
    const dbItems = await Model.find({ sourceId: { $in: dup.sourceIds } }).select('province organizer').lean();
    const prov = dbItems.find(i => i.province)?.province;
    const org = dbItems.find(i => i.organizer)?.organizer;
    if (prov) dup.province = prov;
    if (org) dup.organizer = org;

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
  const concurrency = config.crawl.concurrency || 30;

  const reportProgress = async (message) => {
    if (typeof onProgress === 'function') await onProgress(message);
  };

  // ── Auction ──
  if (auctionIds.size > 0) {
    await reportProgress(`Đang cào detail cho ${auctionIds.size} bài auction trong nhóm duplicate...`);

    const items = await AuctionNotice.find({
      sourceId: { $in: [...auctionIds] },
      detailScraped: { $ne: true },
    }).select('_id sourceId').lean();

    skipped += auctionIds.size - items.length;
    console.log(`[Dup Detail Auction] ${auctionIds.size} tổng → ${items.length} chưa cào, ${auctionIds.size - items.length} đã bỏ qua`);

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

    const items = await OrgSelection.find({
      sourceId: { $in: [...orgIds] },
      detailScraped: { $ne: true },
    }).select('_id sourceId').lean();

    skipped += orgIds.size - items.length;
    console.log(`[Dup Detail Org] ${orgIds.size} tổng → ${items.length} chưa cào, ${orgIds.size - items.length} đã bỏ qua`);

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


async function getFuzzyNameGroups(Model, progressCallback) {
  const items = await Model.find({ name: { $type: 'string', $ne: '' } })
    .select('sourceId name province')
    .maxTimeMS(0)
    .lean();

  if (progressCallback) await progressCallback(`Đã tải ${items.length} bản ghi để gom nhóm tương đồng 70%...`);

  const buckets = {};
  for (const item of items) {
    const prov = normalizeProvince(item.province) || 'unknown';
    if (!buckets[prov]) buckets[prov] = {};
    const cleanName = item.name.toLowerCase().replace(/[,\.\(\):\-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!buckets[prov][cleanName]) buckets[prov][cleanName] = { name: item.name, sourceIds: [] };
    buckets[prov][cleanName].sourceIds.push(item.sourceId);
  }

  const allFuzzyGroups = [];
  const provKeys = Object.keys(buckets);
  let processedProv = 0;

  for (const prov of provKeys) {
    const cleanNames = Object.keys(buckets[prov]);
    if (cleanNames.length === 0) continue;

    // ★ THUẬT TOÁN V2: So sánh trên LÕI DANH TÍNH
    const data = cleanNames.map((cleanName, i) => {
      const originalName = buckets[prov][cleanName].name;
      return {
        index: i,
        coreBigrams: getBigrams(extractCoreIdentity(originalName)),
        numbers: getNumberTokens(originalName),
        identifiers: extractPropertyIdentifiers(originalName),
        sourceIds: buckets[prov][cleanName].sourceIds
      };
    });

    // Sắp xếp theo kích thước core bigrams để tối ưu hoá break sớm
    data.sort((a, b) => a.coreBigrams.size - b.coreBigrams.size);

    const parent = Array.from({ length: data.length }, (_, i) => i);
    const find = (i) => {
      if (parent[i] === i) return i;
      return parent[i] = find(parent[i]);
    };
    const union = (i, j) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    let lastYield = Date.now();
    for (let i = 0; i < data.length; i++) {
      if (i % 200 === 0) {
        const pct = ((i / data.length) * 100).toFixed(1);
        console.log(`[DUPLICATE SCAN] Tỉnh [${prov}] - Phân tích: ${i}/${data.length} (${pct}%)`);
      }

      const sizeA = data[i].coreBigrams.size;
      if (sizeA === 0) continue;
      const maxSizeB = sizeA / 0.60; // Ngưỡng thấp nhất là 60%

      for (let j = i + 1; j < data.length; j++) {
        if (j % 500 === 0 && Date.now() - lastYield > 20) {
          await new Promise(resolve => setImmediate(resolve));
          lastYield = Date.now();
        }

        const sizeB = data[j].coreBigrams.size;
        if (sizeB === 0) continue;

        // BƯỚC 0: Xung đột ĐỊNH DANH (VD: Thửa đất số 01 vs Thửa đất số 02) → REJECT NGAY
        if (hasConflictingIdentifiers(data[i].identifiers, data[j].identifiers)) {
          continue;
        }

        // BƯỚC 0.5: Trùng khớp định danh mạnh (Thửa + tờ bản đồ, biển số xe...) -> CHẤP NHẬN NGAY
        if (hasMatchingStrongIdentifiers(data[i].identifiers, data[j].identifiers)) {
          union(i, j);
          continue;
        }

        if (sizeB > maxSizeB) continue;

        // BƯỚC 1: Kiểm tra số
        const bothHaveNumbers = data[i].numbers.length > 0 && data[j].numbers.length > 0;
        if (bothHaveNumbers) {
          const common = data[i].numbers.filter(t => data[j].numbers.includes(t));
          if (common.length === 0) continue; // Khác số → REJECT
        }

        // BƯỚC 2: So sánh core identity
        const coreSim = jaccardSimilarity(data[i].coreBigrams, data[j].coreBigrams);

        if (coreSim >= 0.80) {
          union(i, j);
        } else if (bothHaveNumbers && coreSim >= 0.60) {
          const common = data[i].numbers.filter(t => data[j].numbers.includes(t));
          if (common.length > 0) union(i, j);
        }
      }
    }

    const provGroups = {};
    for (let i = 0; i < data.length; i++) {
      const root = find(i);
      if (!provGroups[root]) provGroups[root] = [];
      provGroups[root].push(...data[i].sourceIds);
    }

    for (const root in provGroups) {
      const ids = [...new Set(provGroups[root])];
      if (ids.length >= 2) {
        allFuzzyGroups.push({ ids: ids });
      }
    }

    processedProv++;
    const msg = `Gom nhóm tương đồng 70%: đang xử lý [${prov}] (${data.length} mục) - Tiến độ: ${processedProv}/${provKeys.length} tỉnh/thành`;
    console.log(`[DUPLICATE SCAN] ${msg}`); // Báo cáo trực tiếp ra màn hình Terminal ngay lập tức cho từng tỉnh!

    if (progressCallback && (processedProv % 2 === 0 || processedProv === provKeys.length)) {
      await progressCallback(msg); // Lưu vào DB (và hiện lên web) mỗi 2 tỉnh để web không bị đơ
    }
  }

  return allFuzzyGroups;
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
    await saveProgress('Đang xoá dữ liệu duplicate cũ để tạo mới hoàn toàn...');
    await Duplicate.deleteMany({});

    const auctions = await AuctionNotice.find({ relatedIds: { $exists: true, $not: { $size: 0 } } })
      .select('sourceId relatedIds')
      .maxTimeMS(0)
      .lean();
    await saveProgress('Đang gom nhóm AuctionNotice (tương đồng >70%)...');
    const nameGroupsAuction = await getFuzzyNameGroups(AuctionNotice, saveProgress);
    await processTypeGroups('auction', 'AuctionNotice', auctions, nameGroupsAuction);

    const orgs = await OrgSelection.find({ relatedIds: { $exists: true, $not: { $size: 0 } } })
      .select('sourceId relatedIds')
      .maxTimeMS(0)
      .lean();
    await saveProgress('Đang gom nhóm OrgSelection (tương đồng >70%)...');
    const nameGroupsOrg = await getFuzzyNameGroups(OrgSelection, saveProgress);
    await processTypeGroups('org', 'OrgSelection', orgs, nameGroupsOrg);

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

async function runOrganizerDuplicateScan(organizerName) {
  if (!organizerName) throw new Error('Organizer name is required');
  
  duplicateScanState.isRunning = true;
  duplicateScanState.cancelRequested = false;

  const log = await CrawlLog.create({
    type: 'organizer_duplicate_scan',
    startedAt: new Date(),
    status: 'running',
    itemsUpdated: 0,
    itemsSkipped: 0,
    pagesProcessed: 0,
    errorMessages: [`Bắt đầu quét duplicate cho đơn vị: ${organizerName}`],
  });

  const progressEvery = 10;

  const saveProgress = async (message) => {
    if (message) {
      console.log(`[ORG DUPLICATE SCAN] ${message}`);
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
    const allRelatedGroups = buildGraphGroups(allAuctions, (item) => item.relatedIds);
    // Chỉ giữ lại các nhóm có liên quan đến đơn vị này
    const relatedGroups = allRelatedGroups.filter(g => g.ids.some(id => orgAuctionIds.has(id)));
    console.log(`[ORG DUPLICATE SCAN] 🔗 Tìm thấy ${relatedGroups.length} nhóm theo relatedIds có chứa tài sản của đơn vị.`);

    // 4. Gom nhóm theo tên (fuzzy) (Toàn hệ thống)
    await saveProgress('Gom nhóm theo tên tương đồng...');
    const allNameGroups = await getFuzzyNameGroupsFiltered(allAuctions, saveProgress);
    // Chỉ giữ lại các nhóm có liên quan đến đơn vị này
    const nameGroups = allNameGroups.filter(g => g.ids.some(id => orgAuctionIds.has(id)));
    console.log(`[ORG DUPLICATE SCAN] 🏷️ Tìm thấy ${nameGroups.length} nhóm theo tên tương đồng có chứa tài sản của đơn vị.`);

    // 5. Merge và cập nhật
    const mergedGroups = mergeDuplicateGroups(relatedGroups, nameGroups.map(g => g.ids));
    console.log(`[ORG DUPLICATE SCAN] 📦 Sau khi gộp: ${mergedGroups.length} nhóm trùng lặp.`);

    if (mergedGroups.length === 0) {
      log.status = 'completed';
      log.finishedAt = new Date();
      await saveProgress('Không tìm thấy bài đăng trùng lặp nào cho đơn vị này.');
      console.log(`[ORG DUPLICATE SCAN] ✅ Không có trùng lặp.`);
      return { success: true, logId: log._id };
    }

    await saveProgress(`Đang cập nhật ${mergedGroups.length} nhóm trùng lặp...`);
    const sourceMap = new Map(allAuctions.map(a => [a.sourceId, a]));
    
    // Đảm bảo các nhóm mới tạo có đầy đủ thông tin organizer từ tham số đầu vào
    const operations = buildDuplicateBulkOperations(mergedGroups, sourceMap, 'auction');
    operations.forEach(op => {
      if (op.updateOne.update.$set) {
        op.updateOne.update.$set.organizer = organizerName;
      }
    });

    for (let index = 0; index < operations.length; index += progressEvery) {
      await ensureNotCancelled();
      const batch = operations.slice(index, index + progressEvery);
      await Duplicate.bulkWrite(batch, { ordered: false });
      log.itemsUpdated += batch.length;
      await saveProgress(`Đã cập nhật ${Math.min(index + batch.length, operations.length)}/${operations.length} nhóm`);
    }

    // 6. Rebuild entries (giá, ngày...) cho các nhóm vừa tạo
    await saveProgress('Đang cập nhật thông tin chi tiết (giá, ngày...) cho các nhóm...');
    console.log(`[ORG DUPLICATE SCAN] 🛠️ Đang cập nhật chi tiết cho ${mergedGroups.length} nhóm...`);
    let processedEntries = 0;
    for (const group of mergedGroups) {
      const allIds = [...new Set(group)].sort((a, b) => a - b);
      const entries = await buildDuplicateEntries(allIds, 'auction');
      const summary = summarizeDuplicateEntries(entries, 'auction');
      
      // Nếu không có rootId từ history API, dùng ID nhỏ nhất làm gốc
      const finalRootId = summary.rootId || allIds[0];

      // Cập nhật nhóm Duplicate
      await Duplicate.updateOne(
        { type: 'auction', sourceIds: { $in: allIds } },
        { 
          $set: { 
            ...summary, 
            rootId: finalRootId,
            organizer: organizerName 
          } 
        }
      );

      // Cập nhật ngược lại từng AuctionNotice
      for (const entry of entries) {
        await AuctionNotice.updateOne(
          { sourceId: entry.sourceId },
          { 
            $set: { 
              publishRound: entry.publishRound,
              publishRoundLabel: entry.publishRoundLabel || `Thông báo công khai lần ${entry.publishRound}`,
              rootId: finalRootId
            }
          }
        );
      }

      processedEntries++;
      if (processedEntries % 5 === 0) {
        console.log(`[ORG DUPLICATE SCAN]   - Tiến độ rebuild: ${processedEntries}/${mergedGroups.length}`);
      }
    }

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
async function getFuzzyNameGroupsFiltered(items, progressCallback) {
  const { extractCoreIdentity, getBigrams, getNumberTokens, extractPropertyIdentifiers, hasConflictingIdentifiers, hasMatchingStrongIdentifiers, jaccardSimilarity, normalizeProvince } = require('../utils/helpers');

  const buckets = {};
  for (const item of items) {
    const prov = normalizeProvince(item.province) || 'unknown';
    if (!buckets[prov]) buckets[prov] = {};
    
    // Áp dụng chuẩn hóa NFC cho tên để tránh lỗi sai khác do bộ gõ tiếng Việt
    const normalizedName = item.name ? item.name.normalize('NFC').normalize('NFD') : '';
    const cleanName = normalizedName.toLowerCase().replace(/[,\.\(\):\-]/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (!buckets[prov][cleanName]) buckets[prov][cleanName] = { name: item.name, sourceIds: [] };
    buckets[prov][cleanName].sourceIds.push(item.sourceId);
  }

  const allFuzzyGroups = [];
  const provKeys = Object.keys(buckets);
  for (const prov of provKeys) {
    const cleanNames = Object.keys(buckets[prov]);
    if (cleanNames.length === 0) continue;

    const data = cleanNames.map((cleanName, i) => {
      const originalName = buckets[prov][cleanName].name;
      return {
        index: i,
        coreBigrams: getBigrams(extractCoreIdentity(originalName)),
        numbers: getNumberTokens(originalName),
        identifiers: extractPropertyIdentifiers(originalName),
        sourceIds: buckets[prov][cleanName].sourceIds
      };
    });

    data.sort((a, b) => a.coreBigrams.size - b.coreBigrams.size);
    const parent = Array.from({ length: data.length }, (_, i) => i);
    const find = (i) => {
      if (parent[i] === i) return i;
      return parent[i] = find(parent[i]);
    };
    const union = (i, j) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    for (let i = 0; i < data.length; i++) {
      const sizeA = data[i].coreBigrams.size;
      if (sizeA === 0) continue;
      const maxSizeB = sizeA / 0.60;
      for (let j = i + 1; j < data.length; j++) {
        const sizeB = data[j].coreBigrams.size;
        if (sizeB === 0) continue;
        if (hasConflictingIdentifiers(data[i].identifiers, data[j].identifiers)) continue;
        if (hasMatchingStrongIdentifiers(data[i].identifiers, data[j].identifiers)) {
          union(i, j);
          continue;
        }
        if (sizeB > maxSizeB) continue;
        const bothHaveNumbers = data[i].numbers.length > 0 && data[j].numbers.length > 0;
        if (bothHaveNumbers) {
          const common = data[i].numbers.filter(t => data[j].numbers.includes(t));
          if (common.length === 0) continue;
        }
        const coreSim = jaccardSimilarity(data[i].coreBigrams, data[j].coreBigrams);
        if (coreSim >= 0.80) {
          union(i, j);
        } else if (bothHaveNumbers && coreSim >= 0.60) {
          const common = data[i].numbers.filter(t => data[j].numbers.includes(t));
          if (common.length > 0) union(i, j);
        }
      }
    }

    const provGroups = {};
    for (let i = 0; i < data.length; i++) {
      const root = find(i);
      if (!provGroups[root]) provGroups[root] = [];
      provGroups[root].push(...data[i].sourceIds);
    }
    for (const root in provGroups) {
      const ids = [...new Set(provGroups[root])];
      if (ids.length >= 2) allFuzzyGroups.push({ ids: ids });
    }
  }
  return allFuzzyGroups;
}

module.exports = {
  fetchAuctionItemDetail,
  fetchOrgItemDetail,
  fetchPublishHistory,
  handleDuplicate,
  searchDuplicatesByFuzzyName,
  getFuzzyNameGroupsFiltered,
  buildDuplicateEntries,
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
};

