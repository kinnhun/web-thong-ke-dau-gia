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

  // Dùng text index thay vì regex → nhanh hơn 100x trên 500k+ docs
  // Đóng ngoặc kép để bắt buộc MongoDB tìm CHÍNH XÁC CỤM TỪ (phrase match), 
  // thay vì tìm mặc định theo kiểu OR (có chữ "đất" là ra hết)
  return { $text: { $search: `"${keyword}"` } };
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
    if (req.query.status) filter.status = req.query.status;
    const searchFilter = buildTextSearchFilter(req.query.search);
    if (searchFilter) Object.assign(filter, searchFilter);
    if (req.query.minPrice || req.query.maxPrice) {
      filter.currentPrice = {};
      if (req.query.minPrice) filter.currentPrice.$gte = parseInt(req.query.minPrice);
      if (req.query.maxPrice) filter.currentPrice.$lte = parseInt(req.query.maxPrice);
    }
    const sort = { [req.query.sort || 'publishedAt']: req.query.order === 'asc' ? 1 : -1 };

    // Nếu không có filter → dùng estimatedDocumentCount (O(1) thay vì O(N))
    const hasFilter = Object.keys(filter).length > 0;
    const [items, total] = await Promise.all([
      AuctionNotice.find(filter, AUCTION_LIST_FIELDS).sort(sort).skip(skip).limit(limit).lean(),
      hasFilter ? AuctionNotice.countDocuments(filter) : AuctionNotice.estimatedDocumentCount(),
    ]);
    res.json({
      items: items.map(transformAuction),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
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

    // ★ Bỏ live-scrape: trả 404 ngay thay vì block 10-30s để cào
    if (!item) return res.status(404).json({ error: true, message: 'Không tìm thấy' });

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
          const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];
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
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxMegaLimit) : maxMegaLimit;
    const rawConcurrency = Number(req.body?.concurrency);
    const requestedConcurrency = Number.isFinite(rawConcurrency) && rawConcurrency > 0 ? Math.floor(rawConcurrency) : 20;
    const concurrency = Math.max(1, Math.min(requestedConcurrency, 100)); // Cấp max 100 cho crawl tốc độ cao

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

    const items = await Model.find(missingDetailQuery)
      .select({ _id: 1, sourceId: 1, name: 1, province: 1, publishedAt: 1 })
      .sort({ lastCrawledAt: 1, publishedAt: -1 })
      .limit(limit)
      .lean();

    const log = await CrawlLog.create({
      type: 'mega_detail_crawl',
      startedAt: new Date(),
      status: 'running',
      totalPages: items.length,
      pagesProcessed: 0,
      itemsInserted: items.length,
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
      let index = 0;

      const persistProgress = async (force = false) => {
        log.pagesProcessed = processed;
        log.itemsUpdated = ok;
        log.itemsSkipped = fail;
        log.errorMessages = failedItems.map((entry) => `#${entry.sourceId}: ${entry.message}`).slice(-10);
        log.recentNotices = recentNotices;

        if (force || processed % 1000 === 0 || processed === items.length) {
          await log.save();
          console.log(`[MEGA-DETAIL] ${processed}/${items.length}... OK: ${ok}, lỗi: ${fail}, concurrency: ${concurrency}`);
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
              name: updates.name || item.name,
              province: updates.province || item.province,
              publishedAt: updates.publishedAt || item.publishedAt,
            });
          }

          console.log(`[CRAWLED] ${item.sourceId}`);

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

      const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (index < items.length) {
          const item = items[index++];
          await processItem(item);
        }
      });

      try {
        console.log(`[MEGA-DETAIL] Bắt đầu mega crawl ${items.length} ${type}, concurrency=${concurrency}`);
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
      message: `Đã bắt đầu mega crawl ${items.length}/${maxMegaLimit} detail ${type} trong nền, chạy song song ${concurrency} worker`,
      totalMatched: items.length,
      concurrency,
      logId: log._id,
    });
  } catch (err) { next(err); }
});

// Batch re-crawl tất cả items thiếu properties (migration cho dữ liệu cũ)
router.post('/trigger-recrawl-missing-properties', async (req, res, next) => {
  const { fetchAuctionItemDetail, fetchOrgItemDetail } = require('../scrapers/detail.scraper');
  const rawLimit = Number(req.body?.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 0;
  const type = req.body?.type || 'auction';
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const staleThresholdMs = 30 * 60 * 1000;

  const Model = type === 'org' ? OrgSelection : AuctionNotice;
  const fetchFn = type === 'org' ? fetchOrgItemDetail : fetchAuctionItemDetail;

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
      $or: [
        { detailScraped: { $ne: true } },
        { properties: { $exists: false } },
        { properties: { $size: 0 } },
        ...isMissingString('name'),
        ...isMissingString('shortDescription'),
        ...isMissingString('owner'),
        ...isMissingString('address'),
        ...isMissingString('province'),
        ...isMissingString('assetDescription'),
        ...isMissingString('requirements'),
        ...isMissingNumber('startingPrice'),
        { receiveTimeStart: { $exists: false } },
        { receiveTimeStart: null },
        { receiveTimeEnd: { $exists: false } },
        { receiveTimeEnd: null },
      ],
    }
    : {
      $or: [
        { detailScraped: { $ne: true } },
        { properties: { $exists: false } },
        { properties: { $size: 0 } },
        ...isMissingString('name'),
        ...isMissingString('shortDescription'),
        ...isMissingString('type'),
        ...isMissingString('province'),
        ...isMissingString('address'),
        ...isMissingString('organizer'),
        ...isMissingString('owner'),
        ...isMissingString('quality'),
        ...isMissingString('propertyTypeName'),
        ...isMissingString('propertyAmount'),
        ...isMissingNumber('initialPrice'),
        ...isMissingNumber('currentPrice'),
        ...isMissingNumber('deposit'),
        ...isMissingNumber('applicationFee'),
        { auctionDate: { $exists: false } },
        { auctionDate: null },
        { registrationStart: { $exists: false } },
        { registrationStart: null },
        { registrationEnd: { $exists: false } },
        { registrationEnd: null },
      ],
    };

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

        for await (const item of cursor) {
          try {
            await delay(250);
            const { updates, files } = await fetchFn(item.sourceId);
            updates.detailScraped = true;
            updates.lastCrawledAt = new Date();
            if (files && files.length > 0) updates.files = files;

            await Model.updateOne({ _id: item._id }, { $set: updates });

            if (recentNotices.length < 5) {
              recentNotices.push({
                sourceId: item.sourceId,
                name: updates.name || item.name,
                province: updates.province || item.province,
                publishedAt: updates.publishedAt || item.publishedAt,
              });
            }

            ok++;
          } catch (err) {
            fail++;
            failedItems.push({
              sourceId: item.sourceId,
              message: err.message,
            });
            console.error(`[RECRAWL-PROPS] ❌ ${item.sourceId}:`, err.message);
          }

          processed += 1;
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
      message: `Đã bắt đầu cào lại ${effectiveMatchedCount} ${type} thiếu dữ liệu detail trong nền`,
      scannedCount: totalScanned,
      skippedCompleteCount,
      totalMatched: effectiveMatchedCount,
      logId: log._id,
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
  const command = isWindows
    ? `set CRAWL_DELAY_MS=0&& node src/crawler.js --type=auction --maxPages=0 --startPage=${normalizedStartPage} --pageSize=100 --listOnly=true`
    : [
      'cd /var/www/web-thong-ke-dau-gia/bot-crawls-data',
      'pm2 delete mass-crawl || true',
      `pm2 start src/crawler.js --name mass-crawl -- --type=auction --maxPages=0 --startPage=${normalizedStartPage} --pageSize=100 --listOnly=true`,
      'pm2 save',
    ].join(' && ');

  exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) console.error('[TMP-FULL-CRAWL] start failed:', error.message, stderr);
    else console.log('[TMP-FULL-CRAWL] started:', stdout);
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
    deposit: doc.deposit || 0, applicationFee: doc.applicationFee || 0,
    publishRound: doc.publishRound || 1,
    publishRoundLabel: doc.publishRoundLabel || '',
    rootId: doc.rootId || null,
    relatedIds: doc.relatedIds || [],
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : '',
    auctionDate: doc.auctionDate ? doc.auctionDate.toISOString() : '',
    registrationStart: doc.registrationStart ? doc.registrationStart.toISOString() : '',
    registrationEnd: doc.registrationEnd ? doc.registrationEnd.toISOString() : '',
    status: doc.status || 'unknown',
    organizer: doc.organizer || '', owner: doc.owner || '',
    sourceUrl: doc.sourceUrl || '',
    propertyTypeName: doc.propertyTypeName || '',
    propertyAmount: doc.propertyAmount || '',
    files: doc.files || [],
    properties: doc.properties || [],
  };
}

module.exports = router;
