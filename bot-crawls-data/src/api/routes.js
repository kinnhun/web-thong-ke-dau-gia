const { Router } = require('express');
const { exec } = require('child_process');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');
const CrawlLog = require('../models/CrawlLog');

const router = Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTextSearchFilter(searchQuery) {
  const keyword = String(searchQuery || '').trim().slice(0, 120);
  if (!keyword) return null;

  // Nếu search bằng số → tìm sourceId chính xác (index hit)
  if (/^\d+$/.test(keyword)) {
    return { sourceId: Number(keyword) };
  }

  const words = keyword.split(/\s+/);
  
  // Với các chuỗi tìm kiếm dài (nhiều hơn 3 từ), việc dùng $text phrase match hoặc Logical AND 
  // sẽ khiến MongoDB bị treo (hang) do phải quét regex trên tập kết quả lớn từ Inverted Index.
  // Dùng $regex trực tiếp trên trường 'name' sẽ quét toàn bộ (COLLSCAN) nhưng thời gian cố định 
  // chỉ khoảng 3-5s (vẫn tốt hơn treo 30s+) và ra kết quả chính xác tuyệt đối cụm từ.
  if (words.length > 3) {
    // Escape regex characters
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { name: { $regex: escapedKeyword, $options: 'i' } };
  }

  // Với chuỗi ngắn (<=3 từ), dùng $text Logical AND rất nhanh (chỉ <50ms)
  const andSearch = words.map(w => `"${w}"`).join(' ');
  return { $text: { $search: andSearch } };
}

function buildProvinceFilter(provinceQuery) {
  if (!provinceQuery) return null;

  const provinces = String(provinceQuery)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (provinces.length === 0) return null;
  if (provinces.length === 1) {
    return { $regex: provinces[0], $options: 'i' };
  }

  return {
    $in: provinces.map((province) => new RegExp(province, 'i')),
  };
}

// ═══════════════════════════════════
// AUCTION NOTICES
// ═══════════════════════════════════

// Projection: chỉ lấy fields cần thiết cho list → giảm 60% data transfer
const AUCTION_LIST_FIELDS = {
  sourceId: 1, name: 1, shortDescription: 1, type: 1, province: 1, address: 1,
  initialPrice: 1, currentPrice: 1, deposit: 1, applicationFee: 1,
  publishRound: 1, publishRoundLabel: 1, rootId: 1, relatedIds: 1,
  publishedAt: 1, auctionDate: 1, registrationStart: 1, registrationEnd: 1,
  status: 1, organizer: 1, owner: 1, sourceUrl: 1,
  propertyTypeName: 1, propertyAmount: 1, properties: 1,
};


router.get('/auctions', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const provinceFilter = buildProvinceFilter(req.query.province);
    if (provinceFilter) filter.province = provinceFilter;
    if (req.query.organizer) {
      filter.organizer = { $regex: escapeRegex(req.query.organizer), $options: 'i' };
    }
    if (req.query.status) filter.status = req.query.status;
    const searchFilter = buildTextSearchFilter(req.query.search);
    if (searchFilter) Object.assign(filter, searchFilter);
    if (req.query.maxPrice) {
      const maxP = parseFloat(req.query.maxPrice);
      if (!isNaN(maxP)) {
        filter.currentPrice = filter.currentPrice || {};
        filter.currentPrice.$lte = maxP;
      }
    }
    if (req.query.minPrice) {
      const minP = parseFloat(req.query.minPrice);
      if (!isNaN(minP)) {
        filter.currentPrice = filter.currentPrice || {};
        filter.currentPrice.$gte = minP;
      }
    }
    if (req.query.rounds && req.query.rounds !== 'all') {
      const r = parseInt(req.query.rounds);
      if (!isNaN(r)) filter.publishRound = { $gte: r };
    }
    if (req.query.auctionDateFrom || req.query.auctionDateTo) {
      filter.auctionDate = {};
      if (req.query.auctionDateFrom && req.query.auctionDateFrom !== "") {
        const d = new Date(req.query.auctionDateFrom);
        if (!isNaN(d.getTime())) filter.auctionDate.$gte = d;
      }
      if (req.query.auctionDateTo && req.query.auctionDateTo !== "") {
        const d = new Date(req.query.auctionDateTo);
        if (!isNaN(d.getTime())) filter.auctionDate.$lte = d;
      }
      if (Object.keys(filter.auctionDate).length === 0) delete filter.auctionDate;
    }
    if (req.query.publishedAtFrom || req.query.publishedAtTo) {
      filter.publishedAt = {};
      if (req.query.publishedAtFrom && req.query.publishedAtFrom !== "") {
        const d = new Date(req.query.publishedAtFrom);
        if (!isNaN(d.getTime())) filter.publishedAt.$gte = d;
      }
      if (req.query.publishedAtTo && req.query.publishedAtTo !== "") {
        const d = new Date(req.query.publishedAtTo);
        if (!isNaN(d.getTime())) filter.publishedAt.$lte = d;
      }
      if (Object.keys(filter.publishedAt).length === 0) delete filter.publishedAt;
    }
    let sortField = req.query.sort || 'publishedAt';
    let sortOrder = req.query.order === 'asc' ? 1 : -1;

    // Handle field:order format (e.g., publishedAt:desc)
    if (sortField.includes(':')) {
      const [field, order] = sortField.split(':');
      sortField = field;
      sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;
    }

    const sort = { [sortField]: sortOrder };

    const [items, total] = await Promise.all([
      AuctionNotice.find(filter, AUCTION_LIST_FIELDS).sort(sort).skip(skip).limit(limit).lean(),
      AuctionNotice.countDocuments(filter),
    ]);

    // ⚡ Đồng bộ giá với bản ghi Detail (Duplicate) để tránh lệch giá giữa List và Detail
    const sourceIds = items.map(i => i.sourceId);
    const duplicates = await Duplicate.find({ sourceIds: { $in: sourceIds } }).lean();
    
    const dupMap = new Map();
    duplicates.forEach(d => {
      if (d.sourceIds) {
        d.sourceIds.forEach(sid => dupMap.set(sid, d));
      }
    });

    let enrichedItems = items.map(item => {
      const transformed = transformAuction(item);
      const dup = dupMap.get(item.sourceId);
      if (dup) {
        return {
          ...transformed,
          // Lấy giá từ nhóm trùng lặp (giá lần đầu tiên và giá mới nhất)
          initialPrice: dup.firstPrice || transformed.initialPrice,
          currentPrice: dup.latestPrice || transformed.currentPrice,
          publishRound: dup.relistCount || transformed.publishRound,
          isAggregated: true,
          duplicateId: dup._id.toString()
        };
      }
      return transformed;
    });

    // Nếu FE yêu cầu unique (chỉ hiện 1 đại diện cho mỗi tài sản trên 1 trang)
    if (req.query.unique === 'true') {
      const seenGroups = new Set();
      const uniqueItems = [];
      for (const item of enrichedItems) {
        if (item.duplicateId) {
          if (!seenGroups.has(item.duplicateId)) {
            seenGroups.add(item.duplicateId);
            uniqueItems.push(item);
          }
        } else {
          uniqueItems.push(item);
        }
      }
      enrichedItems = uniqueItems;
    }

    res.json({
      items: enrichedItems,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { 
    console.error(`[API ERROR] /auctions:`, err);
    next(err); 
  }
});


const StatCache = require('../models/StatCache');


router.get('/auctions/stats', async (req, res, next) => {
  try {
    const stat = await StatCache.findOne({ key: 'auctions-stats' }).lean();
    if (stat && stat.data) {
      return res.json(stat.data);
    }
    return res.json({
      total: 0, recentCount: 0, totalOrg: 0,
      totalAuctionDuplicates: 0, totalOrgDuplicates: 0, priceDropCount: 0,
      pendingAuctionDetail: 0, pendingOrgDetail: 0,
      byType: [], byProvince: [], byStatus: []
    });
  } catch (err) { next(err); }
});

router.get('/auctions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let item;
    let isOrg = false;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      item = await AuctionNotice.findById(id).lean();
      if (!item) {
        item = await OrgSelection.findById(id).lean();
        isOrg = true;
      }
    } else {
      item = await AuctionNotice.findOne({ sourceId: parseInt(id) }).lean();
      if (!item) {
        item = await OrgSelection.findOne({ sourceId: parseInt(id) }).lean();
        isOrg = true;
      }
    }

    // ★ Live-scrape: Nếu không có trong DB → thử cào trực tiếp từ nguồn
    if (!item) {
      try {
        console.log(`[LIVE-SCRAPE] #${id} không có trong DB, đang thử cào trực tiếp...`);
        const { fetchAuctionItemDetail } = require('../scrapers/detail.scraper');
        const { updates, files } = await fetchAuctionItemDetail(parseInt(id));
        if (updates && (updates.name || updates.initialPrice)) {
          // Lưu tạm vào DB để lần sau không phải cào lại
          updates.sourceId = parseInt(id);
          updates.detailScraped = true;
          updates.lastCrawledAt = new Date();
          if (files) updates.files = files;
          item = await AuctionNotice.create(updates);
          item = item.toObject();
        }
      } catch (err) {
        console.error(`[LIVE-SCRAPE] ❌ Lỗi khi cào #${id}:`, err.message);
      }
    }

    if (!item) return res.status(404).json({ error: true, message: 'Không tìm thấy tài sản này trên hệ thống và nguồn tin.' });

    // Tìm related items + duplicate group song song (2 queries thay vì tuần tự)
    const dupType = isOrg ? 'org' : 'auction';
    const ModelToUse = isOrg ? OrgSelection : AuctionNotice;
    const hasRelated = item.relatedIds && item.relatedIds.length > 0;

    const [relatedItems, dup] = await Promise.all([
      hasRelated
        ? ModelToUse.find({ sourceId: { $in: item.relatedIds } })
          .select('sourceId name initialPrice publishRound publishedAt')
          .sort({ publishedAt: -1 }).limit(20).lean()
        : [],
      Duplicate.findOne({ sourceIds: item.sourceId, type: dupType }).lean(),
    ]);

    let duplicateGroup = null;
    if (dup) {
      duplicateGroup = {
        id: dup._id.toString(),
        name: dup.name,
        relistCount: dup.relistCount || dup.sourceIds.length,
        isPriceDrop: dup.isPriceDrop || false,
        priceDropPercent: dup.priceDropPercent || 0,
        firstPrice: dup.firstPrice || 0,
        latestPrice: dup.latestPrice || 0,
        entries: dup.entries || [],
      };
    }

    res.json({
      ...transformAuction(item),
      relatedItems: relatedItems.map(r => ({
        id: r._id.toString(), sourceId: r.sourceId, name: r.name,
        initialPrice: r.initialPrice || 0, publishRound: r.publishRound || 1,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : '',
      })),
      duplicateGroup,
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════
// ORG SELECTIONS
// ═══════════════════════════════════

router.get('/org-selections', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.search) filter.$text = { $search: req.query.search };
    if (req.query.province) filter.province = { $regex: req.query.province, $options: 'i' };
    const [items, total] = await Promise.all([
      OrgSelection.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
      OrgSelection.countDocuments(filter),
    ]);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

router.get('/org-selections/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let item;
    if (id.match(/^[0-9a-fA-F]{24}$/)) item = await OrgSelection.findById(id).lean();
    else item = await OrgSelection.findOne({ sourceId: parseInt(id) }).lean();
    if (!item) return res.status(404).json({ error: true, message: 'Không tìm thấy' });

    // Tìm nhóm Duplicate
    let duplicateGroup = null;
    const dup = await Duplicate.findOne({ sourceIds: item.sourceId, type: 'org' }).lean();
    if (dup) {
      duplicateGroup = {
        id: dup._id.toString(),
        name: dup.name,
        relistCount: dup.relistCount || dup.sourceIds.length,
        isPriceDrop: dup.isPriceDrop || false,
        priceDropPercent: dup.priceDropPercent || 0,
        firstPrice: dup.firstPrice || 0,
        latestPrice: dup.latestPrice || 0,
        entries: dup.entries || [],
      };
    }

    res.json({ ...item, duplicateGroup });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════
// DUPLICATES (BÀI ĐĂNG LẠI)
// ═══════════════════════════════════

router.get('/duplicates', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.search) filter.$text = { $search: req.query.search };
    if (req.query.priceDrop === 'true') filter.isPriceDrop = true;

    const provinceFilter = buildProvinceFilter(req.query.province);
    if (provinceFilter) filter.province = provinceFilter;

    if (req.query.organizer) {
      filter.organizer = { $regex: escapeRegex(req.query.organizer), $options: 'i' };
    }

    const sort = {};
    if (req.query.sort === 'priceDropPercent') {
      sort.priceDropPercent = -1;
    } else if (req.query.sort === 'relistCount') {
      sort.relistCount = -1;
    } else {
      sort.updatedAt = -1;
    }

    const [rawItems, total] = await Promise.all([
      Duplicate.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Duplicate.countDocuments(filter),
    ]);

    // ★ FIX N+1: Thu thập TẤT CẢ sourceIds rồi query 1 lần duy nhất
    const allSourceIds = [...new Set(rawItems.flatMap(d => d.sourceIds || []))];
    const [auctionNotices, orgNotices] = await Promise.all([
      allSourceIds.length > 0
        ? AuctionNotice.find({ sourceId: { $in: allSourceIds } })
          .select('sourceId name initialPrice publishRound publishRoundLabel sourceUrl publishedAt status rootId')
          .lean()
        : [],
      allSourceIds.length > 0
        ? OrgSelection.find({ sourceId: { $in: allSourceIds } })
          .select('sourceId name startingPrice publishRound publishRoundLabel sourceUrl publishedAt status rootId')
          .lean()
        : [],
    ]);

    // Index theo sourceId để O(1) lookup
    const auctionMap = new Map(auctionNotices.map(n => [n.sourceId, n]));
    const orgMap = new Map(orgNotices.map(n => [n.sourceId, { ...n, initialPrice: n.startingPrice }]));

    const items = rawItems.map((dup) => {
      const noticeMap = dup.type === 'org' ? orgMap : auctionMap;
      let notices = (dup.sourceIds || []).map(id => {
        const n = noticeMap.get(id);
        if (n) return n;
        return { sourceId: id, initialPrice: null, publishRound: null, sourceUrl: null, publishedAt: null, status: 'Chưa có dữ liệu', isMissing: true };
      });

      notices.sort((a, b) => a.sourceId - b.sourceId);
      notices.forEach((n, idx) => { n.displayRound = idx + 1; });

      let priceChanges = [];
      for (let i = 1; i < notices.length; i++) {
        const prev = notices[i - 1];
        const curr = notices[i];
        if (prev.initialPrice && curr.initialPrice) {
          const diff = curr.initialPrice - prev.initialPrice;
          const diffPercent = Math.round((diff / prev.initialPrice) * 10000) / 100;
          priceChanges.push({ fromRound: i, toRound: i + 1, fromPrice: prev.initialPrice, toPrice: curr.initialPrice, diff, diffPercent, direction: diff < 0 ? 'down' : diff > 0 ? 'up' : 'same' });
        }
      }

      return { ...dup, notices, isPriceDrop: dup.isPriceDrop || false, priceDropPercent: dup.priceDropPercent || 0, firstPrice: dup.firstPrice || 0, latestPrice: dup.latestPrice || 0, priceChanges };
    });

    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

let duplicatesFilterCache = null;
let duplicatesFilterCacheTime = 0;

router.get('/duplicates/filters', async (req, res, next) => {
  try {
    if (duplicatesFilterCache && Date.now() - duplicatesFilterCacheTime < 3600000) {
      return res.json(duplicatesFilterCache);
    }
    const [provinces, organizers] = await Promise.all([
      Duplicate.distinct('province', { province: { $ne: null, $ne: '' } }),
      Duplicate.distinct('organizer', { organizer: { $ne: null, $ne: '' } })
    ]);

    const sortedProvinces = provinces.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
    const sortedOrganizers = organizers.filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));

    duplicatesFilterCache = {
      provinces: sortedProvinces,
      organizers: sortedOrganizers
    };
    duplicatesFilterCacheTime = Date.now();
    res.json(duplicatesFilterCache);
  } catch (err) { next(err); }
});

// GET /api/duplicates/:id - Chi tiết 1 nhóm duplicate
router.get('/duplicates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let dup;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      dup = await Duplicate.findById(id).lean();
    } else {
      // Tìm theo sourceId (nếu truyền sourceId thay vì ObjectId)
      dup = await Duplicate.findOne({ sourceIds: parseInt(id) }).lean();
    }
    if (!dup) return res.status(404).json({ error: true, message: 'Không tìm thấy nhóm trùng lặp' });

    // Nạp chi tiết
    let notices = [];
    const Model = dup.type === 'org' ? OrgSelection : AuctionNotice;
    notices = await Model.find({ sourceId: { $in: dup.sourceIds || [] } })
      .sort({ sourceId: 1 })
      .lean();

    notices.forEach((n, idx) => {
      n.displayRound = idx + 1;
      if (dup.type === 'org' && !n.initialPrice) {
        n.initialPrice = n.startingPrice;
      }
    });

    res.json({
      ...dup,
      notices,
    });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════
// FILTERS & LOGS
// ═══════════════════════════════════

router.get('/crawl-logs', async (req, res, next) => {
  try {
    const logs = await CrawlLog.find().sort({ createdAt: -1 }).limit(20).lean();
    const hasRunningDuplicateScan = logs.some((log) => log.type === 'duplicate_scan' && log.status === 'running');
    const hasRunningCrawl = logs.some((log) => log.status === 'running');
    res.json({ logs, hasRunningDuplicateScan, hasRunningCrawl });
  } catch (err) { next(err); }
});

router.get('/system/backup', async (req, res, next) => {
  try {
    const { createGzip } = require('zlib');
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="thong_ke_dau_gia_backup_${timestamp}.json.gz"`);
    
    const gzip = createGzip();
    gzip.pipe(res);
    
    const writeAsync = (data) => new Promise((resolve, reject) => {
      const canContinue = gzip.write(data);
      if (!canContinue) {
        const onDrain = () => {
          gzip.removeListener('error', onError);
          resolve();
        };
        const onError = (err) => {
          gzip.removeListener('drain', onDrain);
          reject(err);
        };
        gzip.once('drain', onDrain);
        gzip.once('error', onError);
      } else {
        resolve();
      }
    });

    await writeAsync('{"collections":{');
    
    const collections = await db.listCollections().toArray();
    
    for (let i = 0; i < collections.length; i++) {
      const colName = collections[i].name;
      if (i > 0) await writeAsync(',');
      await writeAsync(`"${colName}":[`);
      
      const cursor = db.collection(colName).find();
      let isFirstDoc = true;
      
      for await (const doc of cursor) {
        if (!isFirstDoc) await writeAsync(',');
        await writeAsync(JSON.stringify(doc));
        isFirstDoc = false;
      }
      
      await writeAsync(']');
    }
    
    await writeAsync('}}');
    gzip.end();
    
    console.log(`[BACKUP] Full DB backup completed successfully.`);
  } catch (err) {
    console.error(`[BACKUP] Error during backup:`, err.message);
    if (!res.headersSent) {
      res.status(500).send('Lỗi khi tạo file backup: ' + err.message);
    } else {
      res.end();
    }
  }
});

// ═══════════════════════════════════
// COLLECTION EXPORT (tải từng collection)
// ═══════════════════════════════════

const EXPORTABLE_COLLECTIONS = {
  auctionnotices: { label: 'Thông báo đấu giá' },
  orgselections: { label: 'Lựa chọn tổ chức' },
  duplicates: { label: 'Nhóm trùng lặp' },
  crawllogs: { label: 'Nhật ký crawl' },
  statcaches: { label: 'Cache thống kê' },
};

// Liệt kê các collection có thể tải + số lượng document
router.get('/system/collections', async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const result = await Promise.all(
      collections.map(async (col) => {
        const key = col.name;
        // Mặc định lấy label từ config nếu có, không thì lấy tên nguyên bản
        const label = EXPORTABLE_COLLECTIONS[key]?.label || key;
        const count = await db.collection(key).estimatedDocumentCount();
        return { key, label, count };
      })
    );
    res.json({ collections: result });
  } catch (err) { next(err); }
});

// Stream export 1 collection dưới dạng JSON array, nén gzip
router.get('/system/export/:collection', async (req, res, next) => {
  try {
    const { createGzip } = require('zlib');
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const collectionKey = req.params.collection;
    const format = (req.query.format || 'json').toLowerCase();
    
    // Kiểm tra collection tồn tại
    const collections = await db.listCollections().toArray();
    const exists = collections.some(c => c.name === collectionKey);
    if (!exists) {
      return res.status(404).json({ error: true, message: `Collection "${collectionKey}" không tồn tại.` });
    }

    const collection = db.collection(collectionKey);
    const count = await collection.estimatedDocumentCount();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${collectionKey}_${timestamp}`;

    console.log(`[EXPORT] Bắt đầu xuất ${collectionKey} (${count} documents, format: ${format})`);

    const gzip = createGzip();
    
    const writeAsync = (data) => new Promise((resolve, reject) => {
      const canContinue = gzip.write(data);
      if (!canContinue) {
        const onDrain = () => {
          gzip.removeListener('error', onError);
          resolve();
        };
        const onError = (err) => {
          gzip.removeListener('drain', onDrain);
          reject(err);
        };
        gzip.once('drain', onDrain);
        gzip.once('error', onError);
      } else {
        resolve();
      }
    });

    res.setHeader('Content-Type', 'application/gzip');

    if (format === 'csv') {
      const sample = await collection.findOne({});
      if (!sample) {
        return res.status(404).json({ error: true, message: 'Collection rỗng, không có dữ liệu để xuất.' });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv.gz"`);
      gzip.pipe(res);

      const flattenObj = (obj, prefix = '') => {
        const result = {};
        if (!obj) return result;
        for (const [k, v] of Object.entries(obj)) {
          const key = prefix ? `${prefix}.${k}` : k;
          const isObjectId = v && v.constructor && (v.constructor.name === 'ObjectID' || v.constructor.name === 'ObjectId');
          if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isObjectId) {
            Object.assign(result, flattenObj(v, key));
          } else {
            result[key] = v;
          }
        }
        return result;
      };

      const flatSample = flattenObj(sample);
      const headers = Object.keys(flatSample);
      await writeAsync(headers.map(h => `"${h}"`).join(',') + '\n');

      const cursor = collection.find();
      try {
        for await (const doc of cursor) {
          const flat = flattenObj(doc);
          const row = headers.map(h => {
            let val = flat[h];
            if (val === undefined || val === null) val = '';
            else if (Array.isArray(val)) val = JSON.stringify(val);
            else if (val instanceof Date) val = val.toISOString();
            else val = String(val);
            return `"${val.replace(/"/g, '""')}"`;
          }).join(',');
          await writeAsync(row + '\n');
        }
        gzip.end();
        console.log(`[EXPORT] Hoàn thành xuất CSV ${collectionKey}`);
      } catch (err) {
        console.error(`[EXPORT] Lỗi stream CSV ${collectionKey}:`, err.message);
        gzip.end();
      }
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json.gz"`);
      gzip.pipe(res);
      await writeAsync('[');

      let isFirst = true;
      const cursor = collection.find();

      try {
        for await (const doc of cursor) {
          if (!isFirst) await writeAsync(',\n');
          isFirst = false;
          await writeAsync(JSON.stringify(doc));
        }
        await writeAsync(']');
        gzip.end();
        console.log(`[EXPORT] Hoàn thành xuất JSON ${collectionKey}`);
      } catch (err) {
        console.error(`[EXPORT] Lỗi stream JSON ${collectionKey}:`, err.message);
        gzip.end();
      }
    }
  } catch (err) { next(err); }
});

// ═══════════════════════════════════
// MANUAL TRIGGERS
// ═══════════════════════════════════

router.post('/trigger-detail-crawl', async (req, res, next) => {
  try {
    const { crawlDetails, crawlOrgDetails } = require('../scrapers/detail.scraper');
    const limit = parseInt(req.body?.limit) || 30;
    const type = req.body?.type || 'all'; // 'auction', 'org', or 'all'

    (async () => {
      try {
        if (type === 'all' || type === 'auction') await crawlDetails({ maxItems: limit });
        if (type === 'all' || type === 'org') await crawlOrgDetails({ maxItems: limit });
      }
      catch (err) { console.error('[TRIGGER] Lỗi:', err); } finally { const { closeBrowser } = require('../browser'); await closeBrowser().catch(()=>{}); }
    })();
    res.json({ success: true, message: `Re-crawl detail (${limit} items, type: ${type})` });
  } catch (err) { next(err); }
});

router.post('/trigger-fix-missing-data', async (req, res, next) => {
  try {
    const { runFixMissingData } = require('../scrapers/detail.scraper');
    
    // Chạy ngầm không đợi
    runFixMissingData().catch(err => console.error('[TRIGGER] Lỗi Fix Missing Data:', err));
    
    res.json({ success: true, message: `Đã khởi chạy tiến trình quét và sửa dữ liệu lỗi/thiếu ngầm.` });
  } catch (err) { next(err); }
});

// Force re-crawl detail cho 1 item cụ thể (bỏ qua detailScraped)
router.post('/trigger-recrawl-item', async (req, res, next) => {
  try {
    const { fetchAuctionItemDetail, fetchOrgItemDetail, handleDuplicate, searchDuplicatesByFuzzyName, recrawlMissingAuctionDetails } = require('../scrapers/detail.scraper');
    const sourceId = parseInt(req.body?.sourceId);
    const type = req.body?.type || 'auction'; // 'auction' or 'org'
    if (!sourceId) return res.status(400).json({ error: true, message: 'sourceId is required' });

    const Model = type === 'org' ? OrgSelection : AuctionNotice;
    const item = await Model.findOne({ sourceId });
    if (!item) {
      console.log(`[RECRAWL] Not found: ${type} #${sourceId}`);
      return res.status(404).json({ error: true, message: `Không tìm thấy ${type} #${sourceId}` });
    }

    // ⚡ Phản hồi ngay lập tức để tránh timeout (504/500) từ Next.js khi browser mở chậm
    res.json({
      success: true,
      message: `Hệ thống đang tiến hành cào lại chi tiết ${type} #${sourceId} ngầm. Vui lòng tải lại trang sau 15-30 giây để xem dữ liệu cập nhật.`,
      sourceId,
      status: 'processing'
    });

    console.log(`[RECRAWL BG] Bắt đầu xử lý ngầm cho ${type} #${sourceId}...`);

    // Chạy ngầm toàn bộ quá trình cào và cập nhật
    Promise.resolve().then(async () => {
      try {
        const fetchFn = type === 'org' ? fetchOrgItemDetail : fetchAuctionItemDetail;
        const { updates, files } = await fetchFn(sourceId);
        console.log(`[RECRAWL BG] Đã lấy xong fetchFn cho ${type} #${sourceId}. Updates fields:`, Object.keys(updates).length);
        
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;

        await Model.updateOne({ _id: item._id }, { $set: updates });
        console.log(`[RECRAWL BG] Đã cập nhật DB thành công cho #${sourceId}.`);

        if (type === 'auction') {
          const exactNameRelatedIds = await searchDuplicatesByFuzzyName(sourceId, updates.name || item.name, 'auction');
          const Duplicate = require('../models/Duplicate'); const existingDup = await Duplicate.findOne({ sourceIds: sourceId, type: 'auction' }); const duplicateIds = existingDup ? existingDup.sourceIds : []; const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...(item.relatedIds || []), ...duplicateIds, ...exactNameRelatedIds])];
          if (allRelatedIds.length > 0) {
            console.log(`[RECRAWL BG] Bắt đầu quét duplicate cho ${allRelatedIds.length} items...`);
            const relatedDetailStats = await recrawlMissingAuctionDetails([sourceId, ...allRelatedIds], { concurrency: 3 });
            await handleDuplicate(sourceId, updates.name || item.name, allRelatedIds, 'auction');
            console.log(`[RECRAWL BG] 🔁 related detail hoàn thành cho #${sourceId}:`, relatedDetailStats);
          }
        }

        const properties = updates.properties || [];
        console.log(`[RECRAWL BG] ✅ ${type} #${sourceId} updated — properties: ${properties.length}`);
      } catch (err) {
        console.error(`[RECRAWL BG] ❌ Lỗi xử lý ngầm #${sourceId}:`, err.message);
      }
    });

  } catch (err) { next(err); }
});

router.post('/trigger-scan-duplicate-item', async (req, res, next) => {
  try {
    const { handleDuplicate, searchDuplicatesByFuzzyName, getFuzzyNameGroupsFiltered } = require('../scrapers/detail.scraper');
    const sourceId = parseInt(req.body?.sourceId);
    const type = req.body?.type || 'auction'; // 'auction' or 'org'
    if (!sourceId) return res.status(400).json({ error: true, message: 'sourceId is required' });

    const Model = type === 'org' ? OrgSelection : AuctionNotice;
    const item = await Model.findOne({ sourceId });
    if (!item) {
      return res.status(404).json({ error: true, message: `Không tìm thấy ${type} #${sourceId}` });
    }

    const log = await CrawlLog.create({
      type: 'duplicate_scan',
      startedAt: new Date(),
      status: 'running',
      itemsUpdated: 0,
      errorMessages: [`Đang quét trùng lặp cho ${type} #${sourceId}`]
    });

    res.json({
      success: true,
      message: `Hệ thống đang tiến hành quét trùng lặp cho ${type} #${sourceId} ngầm. Vui lòng tải lại trang sau vài giây.`,
      sourceId,
      logId: log._id,
      status: 'processing'
    });

    Promise.resolve().then(async () => {
      try {
        if (type !== 'org') {
          const exactNameRelatedIds = await searchDuplicatesByFuzzyName(sourceId, item.name, 'auction');
          const allRelatedIds = [...new Set([...(item.relatedIds || []), ...exactNameRelatedIds])];
          
          if (allRelatedIds.length > 0) {
            console.log(`[SCAN BG] Bắt đầu gộp duplicate cho #${sourceId} với ${allRelatedIds.length} items:`, allRelatedIds);
            
            const itemsToScan = await Model.find({ sourceId: { $in: allRelatedIds } }).select('sourceId name province').lean();
            const groups = await getFuzzyNameGroupsFiltered(itemsToScan, () => {});
            const targetGroup = groups.find(g => g.ids.includes(sourceId));
            
            if (targetGroup) {
              await handleDuplicate(sourceId, item.name, targetGroup.ids, 'auction');
              log.itemsUpdated = targetGroup.ids.length;
              log.errorMessages.push(`Đã gộp thành công ${targetGroup.ids.length} bài đăng.`);
            } else {
              await handleDuplicate(sourceId, item.name, allRelatedIds, 'auction');
              log.itemsUpdated = allRelatedIds.length;
              log.errorMessages.push(`Đã gộp thành công ${allRelatedIds.length} bài đăng (Fallback).`);
            }
            console.log(`[SCAN BG] ✅ Hoàn thành cho #${sourceId}`);
          } else {
             log.errorMessages.push(`Không tìm thấy bài đăng nào có thể gộp với #${sourceId}.`);
          }
        } else {
           log.errorMessages.push(`Tính năng quét trùng lặp đơn lẻ chưa hỗ trợ cho loại 'org'.`);
        }
        log.status = 'completed';
      } catch (err) {
        console.error(`[SCAN BG] ❌ Lỗi xử lý ngầm #${sourceId}:`, err.message);
        log.status = 'failed';
        log.errorMessages.push(`Lỗi: ${err.message}`);
      } finally {
        log.finishedAt = new Date();
        await CrawlLog.updateOne({ _id: log._id }, { $set: { status: log.status, finishedAt: log.finishedAt, itemsUpdated: log.itemsUpdated, errorMessages: log.errorMessages } });
      }
    });

  } catch (err) { next(err); }
});

// Force re-crawl detail cho NHIỀU item liên quan (bài đăng lại) cùng lúc
// ⚠️ Safety: max 100 items, lock chống spam, concurrency = 2, delay giữa chunks
// Hệ thống hàng đợi (Queue) cho cào bài liên quan
const _recrawlIdQueue = []; // Mảng chứa { sourceId, type }
let _recrawlWorkerActive = false;

async function processRecrawlQueue() {
  if (_recrawlWorkerActive || _recrawlIdQueue.length === 0) return;
  _recrawlWorkerActive = true;

  const { fetchAuctionItemDetail, fetchOrgItemDetail, handleDuplicate } = require('../scrapers/detail.scraper');
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const concurrency = 2;

  console.log(`[QUEUE] Bắt đầu xử lý hàng đợi. Tổng: ${_recrawlIdQueue.length} items`);

  while (_recrawlIdQueue.length > 0) {
    // Lấy một nhóm item để xử lý song song theo concurrency
    const chunk = _recrawlIdQueue.splice(0, concurrency);
    
    await Promise.allSettled(chunk.map(async (job) => {
      const { sourceId, type } = job;
      try {
        const Model = type === 'org' ? OrgSelection : AuctionNotice;
        const fetchFn = type === 'org' ? fetchOrgItemDetail : fetchAuctionItemDetail;

        const item = await Model.findOne({ sourceId }).lean();
        if (!item) {
          console.log(`[QUEUE] Bỏ qua #${sourceId} — không tìm thấy`);
          return;
        }

        const { updates, files } = await fetchFn(sourceId);
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;
        await Model.updateOne({ _id: item._id }, { $set: updates });

        if (type === 'auction') {
          const Duplicate = require('../models/Duplicate');
          const existingDup = await Duplicate.findOne({ sourceIds: sourceId, type: 'auction' });
          const idsToHandle = existingDup ? existingDup.sourceIds : (updates.relatedIds || item.relatedIds || []);
          if (idsToHandle && idsToHandle.length > 0) {
          await handleDuplicate(sourceId, updates.name || item.name, idsToHandle, 'auction');
        }
        }
        console.log(`[QUEUE] ✅ #${sourceId} hoàn thành. Còn lại: ${_recrawlIdQueue.length}`);
      } catch (err) {
        console.error(`[QUEUE] ❌ #${sourceId} lỗi:`, err.message);
      }
    }));

    if (_recrawlIdQueue.length > 0) {
      await delay(1000); // Nghỉ 1 giây giữa các đợt
    }
  }

  console.log(`[QUEUE] Đã xử lý xong hàng đợi.`);
  _recrawlWorkerActive = false;
}

router.post('/trigger-recrawl-related', async (req, res, next) => {
  try {
    const sourceIds = req.body?.sourceIds;
    const type = req.body?.type || 'auction';

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ error: true, message: 'sourceIds (array) is required' });
    }

    // Tăng giới hạn lên 500 item mỗi lần gửi để khớp với frontend
    const ids = [...new Set(sourceIds.map(id => parseInt(id)).filter(Boolean))].slice(0, 500);
    
    // Thêm vào hàng đợi
    ids.forEach(id => {
      // Tránh thêm trùng lặp vào hàng đợi đang chờ
      const isQueued = _recrawlIdQueue.some(q => q.sourceId === id && q.type === type);
      if (!isQueued) {
        _recrawlIdQueue.push({ sourceId: id, type });
      }
    });

    // Kích hoạt worker xử lý ngầm (nếu chưa chạy)
    processRecrawlQueue().catch(err => console.error('[QUEUE] Worker crash:', err));

    res.json({
      success: true,
      message: `Đã thêm ${ids.length} bài viết vào hàng đợi xử lý. Hệ thống sẽ tự động cào ngầm.`,
      queueSize: _recrawlIdQueue.length,
      status: 'queued'
    });
  } catch (err) { next(err); }
});

// Mega crawl detail theo danh sách đã có: lấy 5000 item và cào detail như nút "Cào lại" ở trang detail
router.post('/trigger-mega-detail-crawl', async (req, res, next) => {
  try {
    const {
      fetchAuctionItemDetail,
      fetchOrgItemDetail,
      handleDuplicate,
      searchDuplicatesByFuzzyName,
      recrawlMissingAuctionDetails,
    } = require('../scrapers/detail.scraper');

    const type = req.body?.type || 'auction';
    const staleThresholdMs = 30 * 60 * 1000;

    const Model = type === 'org' ? OrgSelection : AuctionNotice;
    const fetchFn = type === 'org' ? fetchOrgItemDetail : fetchAuctionItemDetail;
    const maxMegaLimit = await Model.countDocuments({ sourceId: { $exists: true, $ne: null } });
    const rawLimit = Number(req.body?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxMegaLimit) : 5000;
    const rawConcurrency = Number(req.body?.concurrency);
    const requestedConcurrency = Number.isFinite(rawConcurrency) && rawConcurrency > 0 ? Math.floor(rawConcurrency) : 10;
    const concurrency = Math.max(1, Math.min(requestedConcurrency, 30)); // Giới hạn max 30 để tránh block browser

    const runningHeavyLog = await CrawlLog.findOne({
      status: 'running',
      type: { $in: ['duplicate_scan', 'recrawl_missing_properties'] },
    }).sort({ createdAt: -1 });

    if (runningHeavyLog) {
      return res.status(409).json({
        success: false,
        message: `Đang có tiến trình nặng ${runningHeavyLog.type} chạy nền. Vui lòng chờ hoàn tất hoặc dừng job đó trước khi mega crawl detail.`,
        logId: runningHeavyLog._id,
        startedAt: runningHeavyLog.startedAt || runningHeavyLog.createdAt,
        updatedAt: runningHeavyLog.updatedAt,
      });
    }

    const runningLog = await CrawlLog.findOne({
      type: 'mega_detail_crawl',
      status: 'running',
    }).sort({ createdAt: -1 });

    if (runningLog) {
      const lastActiveAt = runningLog.updatedAt || runningLog.startedAt || runningLog.createdAt;
      const lastActiveMs = lastActiveAt ? new Date(lastActiveAt).getTime() : 0;
      const isStale = lastActiveMs <= 0 || (Date.now() - lastActiveMs) > staleThresholdMs;

      if (isStale) {
        runningLog.status = 'failed';
        runningLog.finishedAt = new Date();
        runningLog.errorMessages = [
          ...(Array.isArray(runningLog.errorMessages) ? runningLog.errorMessages : []),
          'Mega crawl detail cũ không còn cập nhật trạng thái và đã được đóng tự động để cho phép chạy lại.',
        ].slice(-10);
        await runningLog.save();
      } else {
        return res.status(409).json({
          success: false,
          message: 'Đang có tiến trình mega crawl detail chạy nền. Vui lòng theo dõi trong Nhật ký crawl.',
          logId: runningLog._id,
          startedAt: runningLog.startedAt || runningLog.createdAt,
          updatedAt: runningLog.updatedAt,
        });
      }
    }

    const isMissingString = (field) => ([
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: '' },
    ]);

    const isMissingNumber = (field) => ([
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: 0 },
    ]);

    const missingDetailQuery = type === 'org'
      ? {
        $and: [
          {
            $or: [
              { detailScraped: { $ne: true } },
              { properties: { $exists: false } },
              { properties: { $size: 0 } },
              ...isMissingNumber('startingPrice'),
              ...isMissingString('name'),
              ...isMissingString('province'),
            ]
          },
          { $or: [{ zeroPriceRetryCount: { $exists: false } }, { zeroPriceRetryCount: { $lt: 2 } }] }
        ]
      }
      : {
        $and: [
          {
            $or: [
              { detailScraped: { $ne: true } },
              { properties: { $exists: false } },
              { properties: { $size: 0 } },
              ...isMissingNumber('initialPrice'),
              ...isMissingString('name'),
              ...isMissingString('province'),
            ]
          },
          { $or: [{ zeroPriceRetryCount: { $exists: false } }, { zeroPriceRetryCount: { $lt: 2 } }] }
        ]
      };

    const cursor = Model.find(missingDetailQuery)
      .select({ _id: 1, sourceId: 1, name: 1, province: 1, publishedAt: 1 })
      .sort({ lastCrawledAt: 1, publishedAt: -1 })
      .limit(limit)
      .cursor();

    const totalCount = limit;
    const log = await CrawlLog.create({
      type: 'mega_detail_crawl',
      startedAt: new Date(),
      status: 'running',
      totalPages: totalCount,
      pagesProcessed: 0,
      itemsInserted: totalCount,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errorMessages: [],
      recentNotices: [],
    });

    (async () => {
      const failedItems = [];
      const recentNotices = [];
      let ok = 0;
      let fail = 0;
      let processed = 0;

      const persistProgress = async (force = false) => {
        log.pagesProcessed = processed;
        log.itemsUpdated = ok;
        log.itemsSkipped = fail;
        log.errorMessages = failedItems.map((entry) => `#${entry.sourceId}: ${entry.message}`).slice(-10);
        log.recentNotices = recentNotices;

        if (force || processed % 10 === 0) {
          await log.save();
        }
      };

      const processItem = async (item) => {
        try {
          const { updates, files } = await fetchFn(item.sourceId);
          updates.detailScraped = true;
          updates.lastCrawledAt = new Date();
          if (files && files.length > 0) updates.files = files;

          const priceField = type === 'org' ? 'startingPrice' : 'initialPrice';
          const isStillMissingPrice = !updates.properties || updates.properties.length === 0 || !updates[priceField];

          const updateCommand = { $set: updates };
          if (isStillMissingPrice) {
            updateCommand.$inc = { zeroPriceRetryCount: 1 };
          } else {
            updates.zeroPriceRetryCount = 0;
          }

          await Model.updateOne({ _id: item._id }, updateCommand);

          if (type === 'auction') {
            const exactNameRelatedIds = await searchDuplicatesByFuzzyName(item.sourceId, updates.name || item.name, 'auction');
            const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];
            if (allRelatedIds.length > 0) {
              await handleDuplicate(item.sourceId, updates.name || item.name, allRelatedIds, 'auction');
            }
          }

          if (recentNotices.length < 5) {
            recentNotices.push({
              sourceId: item.sourceId,
              name: (updates.name || item.name || "").substring(0, 100),
              province: updates.province || item.province,
              publishedAt: updates.publishedAt || item.publishedAt,
            });
          }

          ok++;
        } catch (err) {
          fail++;
          failedItems.push({ sourceId: item.sourceId, message: err.message });
          console.error(`[MEGA-DETAIL] ❌ ${item.sourceId}:`, err.message);
        } finally {
          processed += 1;
          await persistProgress(false);
        }
      };

      try {
        console.log(`[MEGA-DETAIL] Bắt đầu mega crawl ${totalCount} ${type}, concurrency=${concurrency}`);
        
        const workers = [];
        for (let i = 0; i < concurrency; i++) {
          workers.push((async () => {
            let item;
            while ((item = await cursor.next())) {
              await processItem(item);
            }
          })());
        }

        await Promise.all(workers);
        log.status = 'completed';
        log.finishedAt = new Date();
        await persistProgress(true);
        console.log(`[MEGA-DETAIL] ✅ Hoàn thành: ${ok} OK, ${fail} lỗi`);
      } catch (err) {
        log.status = 'failed';
        log.finishedAt = new Date();
        log.errorMessages = [
          ...(Array.isArray(log.errorMessages) ? log.errorMessages : []),
          err.message,
        ].slice(-10);
        await log.save();
        console.error('[MEGA-DETAIL] Background job failed:', err.message);
      }
    })();

    return res.json({
      success: true,
      message: `Đã bắt đầu mega crawl ${totalCount}/${maxMegaLimit} detail ${type} trong nền, chạy song song ${concurrency} worker`,
      totalMatched: totalCount,
      concurrency,
      logId: log._id,
    });
  } catch (err) { next(err); }
});

let _recrawlMissingCancelRequested = false;

// Batch re-crawl tất cả items thiếu properties (migration cho dữ liệu cũ)
router.post('/trigger-recrawl-missing-properties', async (req, res, next) => {
  const { fetchAuctionItemDetail, fetchOrgItemDetail } = require('../scrapers/detail.scraper');
  const { closeBrowser } = require('../browser');
  const rawLimit = Number(req.body?.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 0;
  const rawConcurrency = Number(req.body?.concurrency);
  const maxConcurrency = Math.max(1, Math.min(Number.isFinite(rawConcurrency) && rawConcurrency > 0 ? Math.floor(rawConcurrency) : 100, 100));
  const type = req.body?.type || 'auction';
  const organizer = req.body?.organizer;
  const staleThresholdMs = 30 * 60 * 1000;
  const maxFailedItems = 50;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const Model = type === 'org' ? OrgSelection : AuctionNotice;
  const fetchFn = type === 'org' ? fetchOrgItemDetail : fetchAuctionItemDetail;
  _recrawlMissingCancelRequested = false;

  const isMissingString = (field) => ([
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: '' },
  ]);

  const isMissingNumber = (field) => ([
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: 0 },
  ]);

  const hasIncompletePropertyRow = {
    properties: {
      $elemMatch: {
        $or: [
          { place: { $exists: false } },
          { place: null },
          { place: '' },
          { startPrice: { $exists: false } },
          { startPrice: null },
          { startPrice: 0 },
          {
            $and: [
              {
                $or: [
                  { depositPercent: { $exists: false } },
                  { depositPercent: null },
                  { depositPercent: '' },
                ],
              },
              {
                $or: [
                  { deposit: { $exists: false } },
                  { deposit: null },
                  { deposit: 0 },
                ],
              },
            ],
          },
          {
            $and: [
              { depositPercent: { $exists: true, $nin: [null, ''] } },
              { deposit: { $gt: 0 } },
            ],
          },
        ],
      },
    },
  };

  const missingDetailQuery = type === 'org'
    ? {
      $or: [
        { detailScraped: { $ne: true } },
        { properties: { $exists: false } },
        { properties: { $size: 0 } },
        hasIncompletePropertyRow,
        ...isMissingString('name'),
        ...isMissingString('address'),
        ...isMissingString('province'),
        ...isMissingNumber('startingPrice'),
      ],
    }
    : {
      $or: [
        { detailScraped: { $ne: true } },
        { properties: { $exists: false } },
        { properties: { $size: 0 } },
        hasIncompletePropertyRow,
        ...isMissingString('name'),
        ...isMissingString('province'),
        ...isMissingString('address'),
        ...isMissingNumber('initialPrice'),
        ...isMissingNumber('currentPrice'),
      ],
    };

  if (organizer) {
    missingDetailQuery.organizer = { $regex: escapeRegex(organizer), $options: 'i' };
  }

  try {
    const runningLog = await CrawlLog.findOne({
      type: 'recrawl_missing_properties',
      status: 'running',
    }).sort({ createdAt: -1 });

    if (runningLog) {
      const lastActiveAt = runningLog.updatedAt || runningLog.startedAt || runningLog.createdAt;
      const lastActiveMs = lastActiveAt ? new Date(lastActiveAt).getTime() : 0;
      const isStale = lastActiveMs <= 0 || (Date.now() - lastActiveMs) > staleThresholdMs;

      if (isStale) {
        runningLog.status = 'failed';
        runningLog.finishedAt = new Date();
        runningLog.errorMessages = [
          ...(Array.isArray(runningLog.errorMessages) ? runningLog.errorMessages : []),
          'Tiến trình cào lại tài sản cũ không còn cập nhật trạng thái và đã được đóng tự động để cho phép chạy lại.',
        ].slice(-10);
        await runningLog.save();
      } else {
        return res.status(409).json({
          success: false,
          message: 'Đang có tiến trình cào lại tài sản chạy nền. Vui lòng theo dõi trong Nhật ký crawl.',
          logId: runningLog._id,
          startedAt: runningLog.startedAt || runningLog.createdAt,
          updatedAt: runningLog.updatedAt,
        });
      }
    }

    const totalScanned = await Model.countDocuments();
    const matchedCount = await Model.countDocuments(missingDetailQuery);
    const effectiveMatchedCount = limit > 0 ? Math.min(matchedCount, limit) : matchedCount;
    const skippedCompleteCount = Math.max(totalScanned - effectiveMatchedCount, 0);

    const log = await CrawlLog.create({
      type: 'recrawl_missing_properties',
      startedAt: new Date(),
      status: 'running',
      totalPages: effectiveMatchedCount,
      pagesProcessed: 0,
      itemsInserted: totalScanned,
      itemsUpdated: 0,
      itemsSkipped: skippedCompleteCount,
      errorMessages: [],
      recentNotices: [],
    });

    (async () => {
      let cursor = null;

      try {
        const query = Model.find(missingDetailQuery)
          .select({ _id: 1, sourceId: 1, name: 1, province: 1, publishedAt: 1 })
          .sort({ publishedAt: -1, createdAt: -1, sourceId: -1 })
          .batchSize(Math.max(maxConcurrency * 2, 100))
          .lean();

        if (limit > 0) {
          query.limit(limit);
        }

        cursor = query.cursor();
        const failedItems = [];
        const recentNotices = [];
        let ok = 0;
        let fail = 0;
        let processed = 0;

        console.log(`[RECRAWL-PROPS] Đã quét ${totalScanned} ${type}, tìm thấy ${effectiveMatchedCount} thiếu dữ liệu detail`);

        function getErrorMessage(error) {
          return error?.message || String(error);
        }

        function isLikelyBlockedMessage(message) {
          return /HTTP\s*(403|406|429)|ERR_BLOCKED|Too Many Requests|rate|captcha|FEC|Forbidden/i.test(message);
        }

        function isTransientMessage(message) {
          return /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket|Target closed|Session closed|Protocol error|Execution context/i.test(message);
        }

        function pushFailure(sourceId, message) {
          failedItems.push({ sourceId, message });
          if (failedItems.length > maxFailedItems) {
            failedItems.splice(0, failedItems.length - maxFailedItems);
          }
        }

        async function fetchItemDetailWithRetry(item) {
          let lastError;
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
              return await fetchFn(item.sourceId);
            } catch (error) {
              lastError = error;
              const message = getErrorMessage(error);
              if (isLikelyBlockedMessage(message) || !isTransientMessage(message) || attempt >= 2) {
                throw error;
              }
              await sleep(1000 * attempt);
            }
          }
          throw lastError;
        }

        async function processItem(item) {
          const { updates, files } = await fetchItemDetailWithRetry(item);
          updates.detailScraped = true;
          updates.lastCrawledAt = new Date();
          if (files && files.length > 0) updates.files = files;

          return {
            updateOne: {
              filter: { _id: item._id },
              update: { $set: updates },
            },
            notice: {
              sourceId: item.sourceId,
              name: updates.name || item.name,
              province: updates.province || item.province,
              publishedAt: updates.publishedAt || item.publishedAt,
            },
          };
        }

        async function processChunk(chunk) {
          const results = await Promise.allSettled(chunk.map(processItem));
          const operations = [];
          const notices = [];
          const errors = [];
          let savedCount = 0;
          let failedCount = 0;

          for (let index = 0; index < results.length; index += 1) {
            const result = results[index];
            const item = chunk[index];

            if (result.status === 'fulfilled') {
              operations.push(result.value);
              notices.push(result.value.notice);
            } else {
              fail++;
              failedCount++;
              const message = getErrorMessage(result.reason);
              errors.push(message);
              pushFailure(item.sourceId, message);
              console.error(`[RECRAWL-PROPS] ❌ ${item.sourceId}:`, message);
            }
          }

          if (operations.length === 0) {
            return { ok: 0, fail: errors.length, blocked: isLikelyBlocked(errors) };
          }

          try {
            await Model.bulkWrite(operations.map((operation) => operation.updateOne), { ordered: false });
            ok += operations.length;
            savedCount = operations.length;
            for (const notice of notices) {
              if (recentNotices.length < 5) {
                recentNotices.push(notice);
              }
            }
          } catch (err) {
            fail += operations.length;
            failedCount += operations.length;
            const message = getErrorMessage(err);
            for (const notice of notices.slice(-10)) {
              pushFailure(notice.sourceId, `bulkWrite: ${message}`);
            }
            console.error(`[RECRAWL-PROPS] ❌ bulkWrite failed:`, message);
            errors.push(message);
          }

          return { ok: savedCount, fail: failedCount, blocked: isLikelyBlocked(errors) };
        }

        function isLikelyBlocked(errors) {
          return errors.some(isLikelyBlockedMessage);
        }

        let chunk = [];
        let activeConcurrency = maxConcurrency;
        let stableChunks = 0;

        for await (const item of cursor) {
          if (_recrawlMissingCancelRequested) {
            log.status = 'early_stopped';
            log.finishedAt = new Date();
            log.errorMessages = [...failedItems.map((entry) => `#${entry.sourceId}: ${entry.message}`).slice(-9), 'Đã dừng job sửa dữ liệu lỗi theo yêu cầu.'].slice(-10);
            await log.save();
            console.warn('[RECRAWL-PROPS] Job stopped by user request');
            return;
          }

          chunk.push(item);

          if (chunk.length < activeConcurrency) {
            continue;
          }

          const chunkStats = await processChunk(chunk);
          processed += chunk.length;
          chunk = [];

          const chunkFailRate = chunkStats.fail / Math.max(chunkStats.ok + chunkStats.fail, 1);
          if (chunkStats.blocked || chunkFailRate >= 0.2) {
            const previousConcurrency = activeConcurrency;
            activeConcurrency = Math.max(10, Math.floor(activeConcurrency / 2));
            stableChunks = 0;
            const pauseMs = chunkStats.blocked ? 30000 : 10000;
            const message = `Phát hiện lỗi cao${chunkStats.blocked ? '/nghi bị chặn' : ''}, giảm worker ${previousConcurrency} -> ${activeConcurrency}, nghỉ ${pauseMs / 1000}s`;
            pushFailure(0, message);
            log.errorMessages = [...failedItems.map((entry) => `#${entry.sourceId}: ${entry.message}`).slice(-8), message].slice(-10);
            await log.save();
            console.warn(`[RECRAWL-PROPS] ${message}`);
            if (chunkStats.blocked) {
              await closeBrowser().catch((error) => console.warn(`[RECRAWL-PROPS] closeBrowser after block failed: ${getErrorMessage(error)}`));
            }
            await sleep(pauseMs);
          } else {
            stableChunks += 1;
            if (stableChunks >= 5 && activeConcurrency < maxConcurrency) {
              activeConcurrency = Math.min(maxConcurrency, activeConcurrency + 10);
              stableChunks = 0;
              console.log(`[RECRAWL-PROPS] Ổn định, tăng worker lên ${activeConcurrency}`);
            }
          }

          log.pagesProcessed = processed;
          log.itemsUpdated = ok;
          log.itemsSkipped = skippedCompleteCount;
          log.errorMessages = failedItems.map((entry) => `#${entry.sourceId}: ${entry.message}`).slice(-10);
          log.recentNotices = recentNotices;

          if (processed % 10 === 0 || processed === effectiveMatchedCount) {
            await log.save();
            console.log(`[RECRAWL-PROPS] ${processed}/${effectiveMatchedCount}... recrawl OK: ${ok}, lỗi: ${fail}, bỏ qua đủ dữ liệu: ${skippedCompleteCount}`);
          }
        }

        if (chunk.length > 0) {
          await processChunk(chunk);
          processed += chunk.length;
          log.pagesProcessed = processed;
          log.itemsUpdated = ok;
          log.itemsSkipped = skippedCompleteCount;
          log.errorMessages = failedItems.map((entry) => `#${entry.sourceId}: ${entry.message}`).slice(-10);
          log.recentNotices = recentNotices;
          await log.save();
        }

        log.status = 'completed';
        log.finishedAt = new Date();
        log.itemsInserted = totalScanned;
        log.itemsUpdated = ok;
        log.itemsSkipped = skippedCompleteCount;
        log.errorMessages = failedItems.map((entry) => `#${entry.sourceId}: ${entry.message}`).slice(-10);
        log.recentNotices = recentNotices;
        await log.save();

        console.log(`[RECRAWL-PROPS] ✅ Hoàn thành: quét ${totalScanned}, recrawl ${ok}, lỗi ${fail}, bỏ qua ${skippedCompleteCount}`);
      } catch (err) {
        try {
          log.status = 'failed';
          log.finishedAt = new Date();
          log.errorMessages = [
            ...(Array.isArray(log.errorMessages) ? log.errorMessages : []),
            err.message,
          ].slice(-10);
          await log.save();
        } catch (saveErr) {
          console.error('[RECRAWL-PROPS] Failed to persist crawl log error:', saveErr.message);
        }

        console.error('[RECRAWL-PROPS] Background job failed:', err.message);
      } finally {
        _recrawlMissingCancelRequested = false;
        if (cursor) {
          try {
            await cursor.close();
          } catch (closeErr) {
            console.error('[RECRAWL-PROPS] Cursor close failed:', closeErr.message);
          }
        }
      }
    })();

    return res.json({
      success: true,
      message: `Đã bắt đầu cào lại ${effectiveMatchedCount} ${type} thiếu dữ liệu detail trong nền, chạy song song tối đa ${maxConcurrency} worker`,
      scannedCount: totalScanned,
      skippedCompleteCount,
      totalMatched: effectiveMatchedCount,
      concurrency: maxConcurrency,
      logId: log._id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/trigger-kill-recrawl-missing-properties', async (req, res, next) => {
  try {
    const runningLog = await CrawlLog.findOne({
      type: 'recrawl_missing_properties',
      status: 'running',
    }).sort({ createdAt: -1 });

    if (!runningLog) {
      return res.status(409).json({
        success: false,
        message: 'Hiện không có tiến trình sửa dữ liệu lỗi nào đang chạy.',
      });
    }

    _recrawlMissingCancelRequested = true;
    runningLog.errorMessages = [
      ...(Array.isArray(runningLog.errorMessages) ? runningLog.errorMessages : []),
      'Đã nhận yêu cầu dừng job sửa dữ liệu lỗi từ admin.',
    ].slice(-10);
    await runningLog.save();

    res.json({
      success: true,
      message: 'Đã gửi yêu cầu dừng job sửa dữ liệu lỗi. Job sẽ dừng sau khi batch hiện tại hoàn tất.',
      logId: runningLog._id,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/trigger-list-crawl', async (req, res, next) => {
  try {
    const { crawlAuctionNotices } = require('../scrapers/auctionNotice.scraper');
    const { crawlOrgSelections } = require('../scrapers/orgSelection.scraper');
    const rawMaxPages = Number(req.body?.maxPages);
    const maxPages = Number.isFinite(rawMaxPages) && rawMaxPages > 0 ? rawMaxPages : 0; // 0 = crawl hết
    const rawStartPage = Number(req.body?.startPage);
    const startPage = Number.isFinite(rawStartPage) && rawStartPage > 0 ? rawStartPage : 1;
    const rawPageSize = Number(req.body?.pageSize);
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : undefined;
    const type = req.body?.type || 'all'; // 'auction', 'org', or 'all'
    const crawlOptions = { maxPages, startPage, ...(pageSize ? { pageSize } : {}) };

    (async () => {
      try {
        if (type === 'all' || type === 'auction') await crawlAuctionNotices(crawlOptions);
        if (type === 'all' || type === 'org') await crawlOrgSelections(crawlOptions);
      }
      catch (err) { console.error('[TRIGGER] Lỗi List Crawl:', err); } finally { const { closeBrowser } = require('../browser'); await closeBrowser().catch(()=>{}); }
    })();
    res.json({
      success: true,
      message: maxPages > 0
        ? `Crawl list (${maxPages} pages từ trang ${startPage}, type: ${type})`
        : `Crawl list FULL từ trang ${startPage}, type: ${type}`,
      maxPages,
      startPage,
      pageSize: pageSize || null,
      type,
    });
  } catch (err) { next(err); }
});

function launchTmpFullCrawl(startPage) {
  const normalizedStartPage = Number.isFinite(startPage) && startPage > 0 ? Math.floor(startPage) : 1;
  const isWindows = process.platform === 'win32';
  const path = require('path');
  const backendDir = path.resolve(__dirname, '../../'); // D:\web-thong-ke-dau-gia\bot-crawls-data

  let command;
  if (isWindows) {
    command = `node src/crawler.js --type=auction --maxPages=0 --startPage=${normalizedStartPage} --pageSize=100 --listOnly=true`;
  } else {
    command = [
      'cd /var/www/web-thong-ke-dau-gia/bot-crawls-data',
      'pm2 delete mass-crawl || true',
      `pm2 start src/crawler.js --name mass-crawl -- --type=auction --maxPages=0 --startPage=${normalizedStartPage} --pageSize=100 --listOnly=true`,
      'pm2 save',
    ].join(' && ');
  }

  const execOptions = {
    cwd: backendDir,
    env: { ...process.env, CRAWL_DELAY_MS: '0' },
    timeout: 30000
  };

  exec(command, execOptions, (error, stdout, stderr) => {
    if (error) {
      console.error(`[TMP-FULL-CRAWL] ❌ Lỗi khởi động (Trang ${normalizedStartPage}):`, error.message);
      if (stderr) console.error(`[STDERR]: ${stderr}`);
    } else {
      console.log(`[TMP-FULL-CRAWL] ✅ Đã bắt đầu từ trang ${normalizedStartPage}`);
      if (stdout) console.log(`[STDOUT]: ${stdout.substring(0, 200)}...`);
    }
  });

  return normalizedStartPage;
}

async function closeStaleAuctionNoticeLogs() {
  const staleThresholdMs = 30 * 60 * 1000;
  const runningLogs = await CrawlLog.find({ type: 'auction_notice', status: 'running' }).sort({ createdAt: -1 });
  const activeLogs = [];

  for (const log of runningLogs) {
    const lastActiveAt = log.updatedAt || log.startedAt || log.createdAt;
    const lastActiveMs = lastActiveAt ? new Date(lastActiveAt).getTime() : 0;
    const isStale = lastActiveMs <= 0 || (Date.now() - lastActiveMs) > staleThresholdMs;

    if (isStale) {
      log.status = 'failed';
      log.finishedAt = new Date();
      log.errorMessages = [
        ...(Array.isArray(log.errorMessages) ? log.errorMessages : []),
        'Tiến trình mass-crawl danh sách cũ không còn cập nhật trạng thái và đã được đóng tự động để cho phép tiếp tục.',
      ].slice(-10);
      await log.save();
      continue;
    }

    activeLogs.push(log);
  }

  return activeLogs;
}

router.post('/tmp/full-crawl/start', async (req, res, next) => {
  try {
    launchTmpFullCrawl(1);
    res.json({ success: true, message: 'Đã bật luồng mass-crawl riêng từ trang 1 để cào đủ 547k dữ liệu.' });
  } catch (err) { next(err); }
});

router.post('/tmp/full-crawl/continue', async (req, res, next) => {
  try {
    const activeLogs = await closeStaleAuctionNoticeLogs();
    const runningLog = activeLogs[0] || null;

    if (runningLog) {
      return res.status(409).json({
        success: false,
        message: 'Đang có tiến trình mass-crawl danh sách chạy nền. Vui lòng theo dõi trong Nhật ký crawl.',
        logId: runningLog._id,
        startedAt: runningLog.startedAt || runningLog.createdAt,
        updatedAt: runningLog.updatedAt,
      });
    }

    const latestLog = await CrawlLog.findOne({ type: 'auction_notice' }).sort({ createdAt: -1 }).lean();
    const lastProcessedPage = Number(latestLog?.lastPage) || Number(latestLog?.pagesProcessed) || 0;
    const nextStartPage = Math.max(lastProcessedPage + 1, 1);
    const startedPage = launchTmpFullCrawl(nextStartPage);

    res.json({
      success: true,
      message: `Đã tiếp tục luồng mass-crawl riêng từ trang ${startedPage}.`,
    });
  } catch (err) { next(err); }
});

router.get('/tmp/full-crawl/status', async (req, res, next) => {
  try {
    const [totalSaved, detailDone] = await Promise.all([
      AuctionNotice.countDocuments(),
      AuctionNotice.countDocuments({ detailScraped: true }),
    ]);

    const runningLogs = (await closeStaleAuctionNoticeLogs()).map((log) => log.toObject());
    const latestLog = await CrawlLog.findOne({ type: 'auction_notice' }).sort({ createdAt: -1 }).lean();

    const target = 547632;
    const logsForStats = runningLogs.length > 0 ? runningLogs : (latestLog ? [latestLog] : []);
    const sumField = (field) => logsForStats.reduce((total, log) => total + (Number(log?.[field]) || 0), 0);
    const firstStartedAt = logsForStats.reduce((oldest, log) => {
      const startedAt = log?.startedAt ? new Date(log.startedAt).getTime() : 0;
      if (!startedAt) return oldest;
      return oldest === 0 ? startedAt : Math.min(oldest, startedAt);
    }, 0);
    const elapsedSeconds = firstStartedAt > 0 ? Math.max(1, Math.floor((Date.now() - firstStartedAt) / 1000)) : 0;
    const aggregateLog = logsForStats.length > 0 ? {
      _id: latestLog?._id,
      status: runningLogs.length > 0 ? 'running' : latestLog?.status,
      startedAt: firstStartedAt > 0 ? new Date(firstStartedAt) : latestLog?.startedAt,
      finishedAt: runningLogs.length > 0 ? null : latestLog?.finishedAt,
      totalPages: sumField('totalPages') || latestLog?.totalPages || 27382,
      pagesProcessed: sumField('pagesProcessed'),
      itemsInserted: sumField('itemsInserted'),
      itemsSkipped: sumField('itemsSkipped'),
      itemsUpdated: sumField('itemsUpdated'),
      recentNotices: latestLog?.recentNotices || [],
      errorMessages: logsForStats.flatMap((log) => log?.errorMessages || []).slice(-20),
      updatedAt: latestLog?.updatedAt,
      workerCount: runningLogs.length,
    } : null;

    const totalPages = aggregateLog?.totalPages || 27382;
    const pagesProcessed = aggregateLog?.pagesProcessed || 0;
    const processedItems = (aggregateLog?.itemsInserted || 0) + (aggregateLog?.itemsUpdated || 0) + (aggregateLog?.itemsSkipped || 0);
    const speedPerSecond = elapsedSeconds > 0 ? Number((processedItems / elapsedSeconds).toFixed(2)) : 0;
    const insertPerSecond = elapsedSeconds > 0 ? Number(((aggregateLog?.itemsInserted || 0) / elapsedSeconds).toFixed(2)) : 0;
    const progressPercent = Math.min(100, Number(((totalSaved / target) * 100).toFixed(2)));
    const pagePercent = totalPages > 0 ? Math.min(100, Number(((pagesProcessed / totalPages) * 100).toFixed(2))) : 0;

    res.json({
      target,
      totalSaved,
      missingToTarget: Math.max(target - totalSaved, 0),
      detailDone,
      detailPending: Math.max(totalSaved - detailDone, 0),
      progressPercent,
      pagePercent,
      speedPerSecond,
      insertPerSecond,
      processedItems,
      elapsedSeconds,
      workerCount: runningLogs.length,
      latestLog: aggregateLog ? {
        id: aggregateLog._id,
        status: aggregateLog.status || 'running',
        startedAt: aggregateLog.startedAt,
        finishedAt: aggregateLog.finishedAt,
        totalPages,
        pagesProcessed,
        itemsInserted: aggregateLog.itemsInserted || 0,
        itemsSkipped: aggregateLog.itemsSkipped || 0,
        itemsUpdated: aggregateLog.itemsUpdated || 0,
        recentNotices: aggregateLog.recentNotices || [],
        errorMessages: aggregateLog.errorMessages || [],
        updatedAt: aggregateLog.updatedAt,
        workerCount: aggregateLog.workerCount || 0,
      } : null,
    });
  } catch (err) { next(err); }
});

router.post('/trigger-organizer-duplicate-scan', async (req, res, next) => {
  try {
    const { runOrganizerDuplicateScan } = require('../scrapers/detail.scraper');
    const { organizer } = req.body;

    if (!organizer) {
      return res.status(400).json({ success: false, message: 'Thiếu tên đơn vị tổ chức.' });
    }

    const runningLog = await CrawlLog.findOne({
      status: 'running',
      type: { $in: ['duplicate_scan', 'organizer_duplicate_scan', 'mega_detail_crawl'] },
    }).sort({ createdAt: -1 });

    if (runningLog) {
      return res.status(409).json({
        success: false,
        message: `Đang có tiến trình ${runningLog.type} chạy nền. Vui lòng chờ hoàn tất.`,
      });
    }

    // Khởi tạo log trước để có ID trả về ngay cho Client
    const log = new CrawlLog({
      type: 'organizer_duplicate_scan',
      status: 'running',
      startedAt: new Date(),
      errorMessages: [`Bắt đầu quét trùng lặp cho đơn vị: ${organizer}`]
    });
    await log.save();

    // Chạy nền
    (async () => {
      try {
        await runOrganizerDuplicateScan(organizer, log);
      } catch (err) {
        console.error('[TRIGGER] Error in organizer duplicate scan:', err);
      }
    })();

    res.json({
      success: true,
      message: `Đã bắt đầu quét trùng lặp cho đơn vị: ${organizer}.`,
      logId: log._id,
    });
  } catch (err) { next(err); }
});

router.post('/trigger-duplicate-scan', async (req, res, next) => {
  try {
    const { runFullDuplicateScan } = require('../scrapers/detail.scraper');
    const staleThresholdMs = 30 * 60 * 1000;

    const runningHeavyLog = await CrawlLog.findOne({
      status: 'running',
      type: { $in: ['mega_detail_crawl', 'recrawl_missing_properties'] },
    }).sort({ createdAt: -1 });

    if (runningHeavyLog) {
      return res.status(409).json({
        success: false,
        message: `Đang có tiến trình nặng ${runningHeavyLog.type} chạy nền. Vui lòng chờ hoàn tất hoặc dừng job đó trước khi quét trùng lặp.`,
        logId: runningHeavyLog._id,
        startedAt: runningHeavyLog.startedAt || runningHeavyLog.createdAt,
        updatedAt: runningHeavyLog.updatedAt,
      });
    }

    const runningLog = await CrawlLog.findOne({
      type: 'duplicate_scan',
      status: 'running',
    }).sort({ createdAt: -1 });

    if (runningLog) {
      const lastActiveAt = runningLog.updatedAt || runningLog.startedAt || runningLog.createdAt;
      const lastActiveMs = lastActiveAt ? new Date(lastActiveAt).getTime() : 0;
      const isStale = lastActiveMs <= 0 || (Date.now() - lastActiveMs) > staleThresholdMs;

      if (isStale) {
        runningLog.status = 'failed';
        runningLog.finishedAt = new Date();
        runningLog.errorMessages = [
          ...(Array.isArray(runningLog.errorMessages) ? runningLog.errorMessages : []),
          'Tiến trình quét cũ không còn cập nhật trạng thái và đã được đóng tự động để cho phép chạy lại.',
        ].slice(-10);
        await runningLog.save();
      } else {
        return res.status(409).json({
          success: false,
          message: 'Đang có một tiến trình quét trùng lặp chạy nền. Vui lòng chờ hoàn tất.',
          logId: runningLog._id,
          startedAt: runningLog.startedAt || runningLog.createdAt,
          updatedAt: runningLog.updatedAt,
        });
      }
    }

    let startedLogId = null;
    (async () => {
      try {
        const result = await runFullDuplicateScan();
        startedLogId = result?.logId || null;
      } catch (err) {
        console.error('[TRIGGER] Error starting duplicate scan:', err);
      }
    })();

    res.json({
      success: true,
      message: 'Đã bắt đầu quét và cập nhật lại nhóm trùng lặp toàn bộ Database.',
      logId: startedLogId,
    });
  } catch (err) { next(err); }
});

router.post('/skip-detail-crawl-setting', async (req, res) => {
  try {
    const { skip } = req.body;
    const { setSkipDetailCrawl } = require('../scrapers/detail.scraper');
    
    const newStatus = setSkipDetailCrawl(skip);
    
    res.json({
      success: true,
      skipDetailCrawl: newStatus,
      message: `Đã ${newStatus ? 'BẬT' : 'TẮT'} chế độ bỏ qua cào dữ liệu khi bị chặn.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Trigger rebuild entries cho Duplicate cũ (migration)
router.post('/trigger-rebuild-duplicates', async (req, res, next) => {
  try {
    const { rebuildAllDuplicateEntries } = require('../scrapers/detail.scraper');

    (async () => {
      try {
        await rebuildAllDuplicateEntries();
      } catch (err) {
        console.error('[TRIGGER] Rebuild error:', err);
      }
    })();

    res.json({ success: true, message: 'Đã bắt đầu rebuild entries + price cho tất cả nhóm Duplicate.' });
  } catch (err) { next(err); }
});

// Trigger cào detail cho tất cả bài trong nhóm duplicate
router.post('/trigger-crawl-duplicate-details', async (req, res, next) => {
  try {
    const { crawlDuplicateGroupsDetail } = require('../scrapers/detail.scraper');

    // Không cho chạy nếu đang có duplicate scan hoặc mega crawl
    const runningLog = await CrawlLog.findOne({
      status: 'running',
      type: { $in: ['duplicate_scan', 'mega_detail_crawl'] },
    }).sort({ createdAt: -1 });

    if (runningLog) {
      return res.status(409).json({
        success: false,
        message: `Đang có tiến trình ${runningLog.type} chạy nền. Vui lòng chờ hoàn tất trước.`,
      });
    }

    const log = await CrawlLog.create({
      type: 'crawl_duplicate_details',
      startedAt: new Date(),
      status: 'running',
      itemsUpdated: 0,
      itemsSkipped: 0,
      pagesProcessed: 0,
      errorMessages: ['Bắt đầu cào detail cho các bài trong nhóm duplicate.'],
    });

    (async () => {
      try {
        const saveProgress = async (message) => {
          if (message) {
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

        const result = await crawlDuplicateGroupsDetail(saveProgress);
        log.status = 'completed';
        log.finishedAt = new Date();
        log.itemsUpdated = result.crawled || 0;
        log.itemsSkipped = result.skipped || 0;
        log.pagesProcessed = result.errors || 0;
        await CrawlLog.updateOne({ _id: log._id }, { $set: { status: log.status, finishedAt: log.finishedAt, itemsUpdated: log.itemsUpdated, itemsSkipped: log.itemsSkipped, pagesProcessed: log.pagesProcessed } });
      } catch (err) {
        log.status = 'failed';
        log.finishedAt = new Date();
        log.errorMessages = [err instanceof Error ? err.message : String(err)];
        await CrawlLog.updateOne({ _id: log._id }, { $set: { status: log.status, finishedAt: log.finishedAt, errorMessages: log.errorMessages } });
        console.error('[TRIGGER] Crawl duplicate details error:', err);
      }
    })();

    res.json({
      success: true,
      message: 'Đã bắt đầu cào detail cho tất cả bài trong nhóm duplicate.',
      logId: log._id,
    });
  } catch (err) { next(err); }
});

router.post('/trigger-kill-duplicate-scan', async (req, res, next) => {
  try {
    const { requestDuplicateScanCancel, getDuplicateScanState } = require('../scrapers/detail.scraper');

    const runningLog = await CrawlLog.findOne({
      type: 'duplicate_scan',
      status: 'running',
    }).sort({ createdAt: -1 });

    const cancelled = requestDuplicateScanCancel();

    if (!runningLog && !cancelled) {
      return res.status(409).json({
        success: false,
        message: 'Hiện không có tiến trình quét trùng lặp nào đang chạy.',
        state: getDuplicateScanState(),
      });
    }

    if (runningLog) {
      const existingMessages = Array.isArray(runningLog.errorMessages) ? runningLog.errorMessages : [];
      const stopMessage = cancelled
        ? 'Đã nhận yêu cầu dừng tiến trình quét duplicate từ quản trị viên.'
        : 'Đã đóng tiến trình quét duplicate bị treo sau khi backend mất trạng thái runtime.';

      runningLog.status = cancelled ? 'failed' : 'early_stopped';
      runningLog.finishedAt = new Date();
      runningLog.errorMessages = [
        ...existingMessages.slice(-4),
        stopMessage,
      ];
      await runningLog.save();

      return res.json({
        success: true,
        message: cancelled
          ? 'Đã gửi yêu cầu dừng tiến trình quét trùng lặp.'
          : 'Đã đóng tiến trình quét trùng lặp bị treo để bạn có thể chạy lại.',
        state: getDuplicateScanState(),
        logId: runningLog._id,
      });
    }

    res.json({
      success: true,
      message: 'Đã gửi yêu cầu dừng tiến trình quét trùng lặp.',
      state: getDuplicateScanState(),
      logId: null,
    });
  } catch (err) { next(err); }
});

// Gộp 2 nhóm duplicate thủ công
router.post('/duplicates/merge', async (req, res, next) => {
  try {
    const { sourceId1, sourceId2, type = 'auction' } = req.body;
    if (!sourceId1 || !sourceId2) return res.status(400).json({ error: 'Missing sourceId1 or sourceId2' });

    const { handleDuplicate } = require('../scrapers/detail.scraper');
    
    // Đơn giản là gọi handleDuplicate với cả 2 ID, nó sẽ tự tìm 2 nhóm cũ và gộp lại
    await handleDuplicate(sourceId1, null, [sourceId2], type);
    
    res.json({ success: true, message: `Đã gộp nhóm chứa #${sourceId1} và #${sourceId2}` });
  } catch (err) { next(err); }
});

// Tách một số ID ra khỏi nhóm duplicate
router.post('/duplicates/split', async (req, res, next) => {
  try {
    const { sourceIds, type = 'auction' } = req.body;
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) return res.status(400).json({ error: 'sourceIds must be an array' });

    const { handleDuplicate } = require('../scrapers/detail.scraper');
    
    // 1. Tìm nhóm hiện tại chứa các ID này
    const dup = await Duplicate.findOne({ sourceIds: { $in: sourceIds }, type });
    if (!dup) return res.status(404).json({ error: 'Group not found' });

    // 2. Loại bỏ IDs khỏi nhóm cũ
    const remainingIds = dup.sourceIds.filter(id => !sourceIds.includes(id));
    
    if (remainingIds.length === 0) {
        await Duplicate.deleteOne({ _id: dup._id });
    } else {
        dup.sourceIds = remainingIds;
        await dup.save();
        // Rebuild lại entries cho nhóm cũ
        await handleDuplicate(remainingIds[0], null, remainingIds.slice(1), type);
    }

    // 3. Tạo nhóm mới từ các ID bị tách ra
    if (sourceIds.length >= 2) {
        await handleDuplicate(sourceIds[0], null, sourceIds.slice(1), type);
    } else {
        // Nếu chỉ tách 1 ID ra làm "đơn lẻ" -> xóa rootId của nó trong AuctionNotice
        const Model = type === 'org' ? OrgSelection : AuctionNotice;
        await Model.updateOne({ sourceId: sourceIds[0] }, { $unset: { rootId: "" }, $set: { relatedIds: [] } });
    }

    res.json({ success: true, message: `Đã tách ${sourceIds.length} bài viết ra khỏi nhóm cũ.` });
  } catch (err) { next(err); }
});

// Xoá hẳn một ID khỏi bất kỳ nhóm duplicate nào
router.post('/duplicates/remove-id', async (req, res, next) => {
    try {
      const { sourceId, type = 'auction' } = req.body;
      if (!sourceId) return res.status(400).json({ error: 'sourceId is required' });
  
      const { handleDuplicate } = require('../scrapers/detail.scraper');
      const dup = await Duplicate.findOne({ sourceIds: sourceId, type });
      if (!dup) return res.json({ success: true, message: 'ID không nằm trong nhóm nào.' });
  
      dup.sourceIds = dup.sourceIds.filter(id => id !== sourceId);
      if (dup.sourceIds.length < 2) {
        await Duplicate.deleteOne({ _id: dup._id });
      } else {
        await dup.save();
        await handleDuplicate(dup.sourceIds[0], null, dup.sourceIds.slice(1), type);
      }
  
      const Model = type === 'org' ? OrgSelection : AuctionNotice;
      await Model.updateOne({ sourceId }, { $unset: { rootId: "" }, $set: { relatedIds: [] } });
  
      res.json({ success: true, message: `Đã loại bỏ #${sourceId} khỏi nhóm trùng lặp.` });
    } catch (err) { next(err); }
  });

// ═══════════════════════════════════
// HELPERS
// ═══════════════════════════════════

function transformAuction(doc) {
  return {
    id: doc._id.toString(), sourceId: doc.sourceId,
    name: doc.name || '', shortDescription: doc.shortDescription || '',
    type: doc.type || (doc.startingPrice ? 'org' : 'other'), province: doc.province || '',
    address: doc.address || '',
    initialPrice: doc.initialPrice || doc.startingPrice || 0, currentPrice: doc.currentPrice || doc.startingPrice || 0,
    deposit: doc.deposit || 0, depositPercent: doc.depositPercent || '',
    applicationFee: doc.applicationFee || 0,
    publishRound: doc.publishRound || 1,
    publishRoundLabel: doc.publishRoundLabel || '',
    rootId: doc.rootId || null,
    relatedIds: doc.relatedIds || [],
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : '',
    auctionDate: doc.auctionDate ? new Date(doc.auctionDate).toISOString() : '',
    registrationStart: doc.registrationStart ? new Date(doc.registrationStart).toISOString() : '',
    registrationEnd: doc.registrationEnd ? new Date(doc.registrationEnd).toISOString() : '',
    status: doc.status || 'unknown',
    organizer: doc.organizer || '', owner: doc.owner || '',
    sourceUrl: doc.sourceUrl || '',
    propertyTypeName: doc.propertyTypeName || '',
    propertyAmount: doc.propertyAmount || '',
    files: doc.files || [],
    properties: doc.properties || [],
  };
}

// ═══════════════════════════════════
// TUNNEL URL (hiển thị link share trên admin)
// ═══════════════════════════════════

router.get('/system/tunnel-url', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  // File .tunnel-url nằm ở root project (ngang hàng với package.json)
  const tunnelFile = path.join(__dirname, '..', '..', '..', '.tunnel-url');
  try {
    if (fs.existsSync(tunnelFile)) {
      const url = fs.readFileSync(tunnelFile, 'utf8').trim();
      if (url) {
        return res.json({ url, active: true });
      }
    }
    res.json({ url: null, active: false, message: 'Tunnel chưa chạy hoặc chưa kết nối.' });
  } catch (err) {
    res.json({ url: null, active: false, message: err.message });
  }
});

module.exports = router;
