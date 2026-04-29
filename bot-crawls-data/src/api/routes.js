const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');
const CrawlLog = require('../models/CrawlLog');

const router = Router();

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
    if (req.query.search) filter.$text = { $search: req.query.search };
    if (req.query.minPrice || req.query.maxPrice) {
      filter.currentPrice = {};
      if (req.query.minPrice) filter.currentPrice.$gte = parseInt(req.query.minPrice);
      if (req.query.maxPrice) filter.currentPrice.$lte = parseInt(req.query.maxPrice);
    }
    const sort = { [req.query.sort || 'publishedAt']: req.query.order === 'asc' ? 1 : -1 };
    const [items, total] = await Promise.all([
      AuctionNotice.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      AuctionNotice.countDocuments(filter),
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
    if (id.match(/^[0-9a-fA-F]{24}$/)) item = await AuctionNotice.findById(id).lean();
    else item = await AuctionNotice.findOne({ sourceId: parseInt(id) }).lean();
    if (!item) return res.status(404).json({ error: true, message: 'Không tìm thấy' });

    // Tìm related items qua relatedIds
    let relatedItems = [];
    if (item.relatedIds && item.relatedIds.length > 0) {
      relatedItems = await AuctionNotice.find({ sourceId: { $in: item.relatedIds } })
        .sort({ publishedAt: -1 }).limit(20).lean();
    }

    // Tìm nhóm Duplicate chứa item này
    let duplicateGroup = null;
    const dup = await Duplicate.findOne({ sourceIds: item.sourceId, type: 'auction' }).lean();
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
    
    // Nạp chi tiết các bài thông báo cho từng nhóm
    const items = await Promise.all(rawItems.map(async (dup) => {
      let notices = [];
      if (dup.type === 'org') {
        notices = await OrgSelection.find({ sourceId: { $in: dup.sourceIds || [] } })
          .select('sourceId name startingPrice publishRound publishRoundLabel sourceUrl publishedAt status rootId')
          .sort({ sourceId: 1 })
          .lean();
        notices.forEach(n => { n.initialPrice = n.startingPrice; }); // Chuẩn hóa name để dùng chung UI
      } else {
        notices = await AuctionNotice.find({ sourceId: { $in: dup.sourceIds || [] } })
          .select('sourceId name initialPrice publishRound publishRoundLabel sourceUrl publishedAt status rootId')
          .sort({ sourceId: 1 })
          .lean();
      }
      
      // Bổ sung các bài đăng chưa được cào data vào danh sách
      const foundIds = notices.map(n => n.sourceId);
      const missingIds = (dup.sourceIds || []).filter(id => !foundIds.includes(id));
      missingIds.forEach(id => {
        notices.push({
          sourceId: id,
          initialPrice: null,
          publishRound: null,
          sourceUrl: null,
          publishedAt: null,
          status: 'Chưa có dữ liệu',
          isMissing: true
        });
      });

      // Sắp xếp theo sourceId tăng dần (id nhỏ -> đăng trước)
      notices.sort((a, b) => a.sourceId - b.sourceId);
      
      // Gắn nhãn Lần 1, 2, 3... theo thứ tự sourceId để UI hiển thị mượt
      notices.forEach((n, idx) => {
        n.displayRound = idx + 1;
      });

      // So sánh giá giữa các lần đăng
      const prices = notices.map(n => n.initialPrice).filter(Boolean);
      const isPriceDrop = dup.isPriceDrop || false;
      const priceDropPercent = dup.priceDropPercent || 0;

      // Tính chi tiết thay đổi giá
      let priceChanges = [];
      for (let i = 1; i < notices.length; i++) {
        const prev = notices[i - 1];
        const curr = notices[i];
        if (prev.initialPrice && curr.initialPrice) {
          const diff = curr.initialPrice - prev.initialPrice;
          const diffPercent = Math.round((diff / prev.initialPrice) * 10000) / 100;
          priceChanges.push({
            fromRound: i,
            toRound: i + 1,
            fromPrice: prev.initialPrice,
            toPrice: curr.initialPrice,
            diff,
            diffPercent,
            direction: diff < 0 ? 'down' : diff > 0 ? 'up' : 'same',
          });
        }
      }

      return {
        ...dup,
        notices,
        isPriceDrop,
        priceDropPercent,
        firstPrice: dup.firstPrice || 0,
        latestPrice: dup.latestPrice || 0,
        priceChanges,
      };
    }));

    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
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
      catch (err) { console.error('[TRIGGER] Lỗi:', err); }
    })();
    res.json({ success: true, message: `Re-crawl detail (${limit} items, type: ${type})` });
  } catch (err) { next(err); }
});

// Force re-crawl detail cho 1 item cụ thể (bỏ qua detailScraped)
router.post('/trigger-recrawl-item', async (req, res, next) => {
  try {
    const { fetchAuctionItemDetail, fetchOrgItemDetail, handleDuplicate, searchDuplicatesByExactName } = require('../scrapers/detail.scraper');
    const sourceId = parseInt(req.body?.sourceId);
    const type = req.body?.type || 'auction'; // 'auction' or 'org'
    if (!sourceId) return res.status(400).json({ error: true, message: 'sourceId is required' });

    const Model = type === 'org' ? OrgSelection : AuctionNotice;
    const item = await Model.findOne({ sourceId });
    if (!item) {
      return res.status(404).json({ error: true, message: `Không tìm thấy ${type} #${sourceId}` });
    }

    const fetchFn = type === 'org' ? fetchOrgItemDetail : fetchAuctionItemDetail;
    const { updates, files } = await fetchFn(sourceId);
    updates.detailScraped = true;
    updates.lastCrawledAt = new Date();
    if (files && files.length > 0) updates.files = files;

    await Model.updateOne({ _id: item._id }, { $set: updates });

    if (type === 'auction') {
      const exactNameRelatedIds = await searchDuplicatesByExactName(sourceId, updates.name || item.name, 'auction');
      const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];
      if (allRelatedIds.length > 0) {
        await handleDuplicate(sourceId, updates.name || item.name, allRelatedIds, 'auction');
      }
    }

    const properties = updates.properties || [];
    console.log(`[RECRAWL] ✅ ${type} #${sourceId} updated — properties: ${properties.length}`);
    res.json({
      success: true,
      message: `Đã cào lại chi tiết ${type} #${sourceId}`,
      sourceId,
      propertiesCount: properties.length,
      totalPrice: properties.reduce((sum, property) => sum + (property.startPrice || 0), 0),
      filesCount: (updates.files || files || []).length,
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

  let log = null;

  try {
    log = await CrawlLog.create({
      type: 'recrawl_missing_properties',
      startedAt: new Date(),
      status: 'running',
      totalPages: limit,
      pagesProcessed: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errorMessages: [],
      recentNotices: [],
    });

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

    const totalScanned = await Model.countDocuments();
    const itemsQuery = Model.find(missingDetailQuery)
      .sort({ publishedAt: -1, createdAt: -1, sourceId: -1 });

    if (limit > 0) {
      itemsQuery.limit(limit);
    }

    const items = await itemsQuery;
    const skippedCompleteCount = Math.max(totalScanned - items.length, 0);

    console.log(`[RECRAWL-PROPS] Đã quét ${totalScanned} ${type}, tìm thấy ${items.length} thiếu dữ liệu detail`);

    let ok = 0;
    let fail = 0;
    const updatedItems = [];
    const failedItems = [];
    const recentNotices = [];

    log.totalPages = items.length;
    log.pagesProcessed = 0;
    log.itemsInserted = totalScanned;
    log.itemsSkipped = skippedCompleteCount;
    await log.save();

    for (const [index, item] of items.entries()) {
      try {
        await delay(250);
        const { updates, files } = await fetchFn(item.sourceId);
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;

        await Model.updateOne({ _id: item._id }, { $set: updates });

        const propertyCount = Array.isArray(updates.properties) ? updates.properties.length : 0;
        updatedItems.push({
          sourceId: item.sourceId,
          propertyCount,
        });

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

      log.pagesProcessed = index + 1;
      log.itemsUpdated = ok;
      log.itemsSkipped = skippedCompleteCount;
      log.errorMessages = failedItems.map((entry) => `#${entry.sourceId}: ${entry.message}`).slice(-10);
      log.recentNotices = recentNotices;

      if ((index + 1) % 10 === 0 || index === items.length - 1) {
        await log.save();
        console.log(`[RECRAWL-PROPS] ${index + 1}/${items.length}... recrawl OK: ${ok}, lỗi: ${fail}, bỏ qua đủ dữ liệu: ${skippedCompleteCount}`);
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

    res.json({
      success: true,
      message: `Đã cào lại ${ok}/${items.length} ${type} thiếu dữ liệu detail`,
      scannedCount: totalScanned,
      skippedCompleteCount,
      totalMatched: items.length,
      successCount: ok,
      failedCount: fail,
      updatedItems: updatedItems.slice(0, 20),
      failedItems: failedItems.slice(0, 20),
      logId: log._id,
    });
  } catch (err) {
    if (log) {
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
    }

    next(err);
  }
});

router.post('/trigger-list-crawl', async (req, res, next) => {
  try {
    const { crawlAuctionNotices } = require('../scrapers/auctionNotice.scraper');
    const { crawlOrgSelections } = require('../scrapers/orgSelection.scraper');
    const maxPages = parseInt(req.body?.maxPages) || 5;
    const type = req.body?.type || 'all'; // 'auction', 'org', or 'all'
    
    (async () => {
      try { 
        if (type === 'all' || type === 'auction') await crawlAuctionNotices({ maxPages }); 
        if (type === 'all' || type === 'org') await crawlOrgSelections({ maxPages }); 
      }
      catch (err) { console.error('[TRIGGER] Lỗi List Crawl:', err); }
    })();
    res.json({ success: true, message: `Crawl list (${maxPages} pages, type: ${type})` });
  } catch (err) { next(err); }
});

router.post('/trigger-duplicate-scan', async (req, res, next) => {
  try {
    const { runFullDuplicateScan } = require('../scrapers/detail.scraper');
    const staleThresholdMs = 30 * 60 * 1000;

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
    type: doc.type || 'other', province: doc.province || '',
    address: doc.address || '',
    initialPrice: doc.initialPrice || 0, currentPrice: doc.currentPrice || 0,
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
