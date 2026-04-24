const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');
const CrawlLog = require('../models/CrawlLog');

const router = Router();

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
    if (req.query.province) filter.province = { $regex: req.query.province, $options: 'i' };
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
    res.json(logs);
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
    const { handleDuplicate, recoverMissingDuplicates, rebuildAllDuplicateEntries } = require('../scrapers/detail.scraper');
    
    // Run in background
    (async () => {
      try {
        console.log('[TRIGGER] Starting full duplicate scan...');
        
        // Scan AuctionNotice by relatedIds
        const auctions = await AuctionNotice.find({ relatedIds: { $exists: true, $not: { $size: 0 } } }).select('sourceId name relatedIds');
        for (const item of auctions) {
          if (item.relatedIds && item.relatedIds.length > 0) {
            await handleDuplicate(item.sourceId, item.name, item.relatedIds, 'auction');
          }
        }
        
        // Scan AuctionNotice by identical Name
        const nameGroupsAuction = await AuctionNotice.aggregate([
          { $group: { _id: "$name", ids: { $push: "$sourceId" }, count: { $sum: 1 } } },
          { $match: { count: { $gte: 2 } } }
        ]);
        for (const group of nameGroupsAuction) {
          if (group._id && group._id.trim() !== '') {
            await handleDuplicate(group.ids[0], group._id, group.ids.slice(1), 'auction');
          }
        }
        
        // Scan OrgSelection by relatedIds
        const orgs = await OrgSelection.find({ relatedIds: { $exists: true, $not: { $size: 0 } } }).select('sourceId name relatedIds');
        for (const item of orgs) {
          if (item.relatedIds && item.relatedIds.length > 0) {
            await handleDuplicate(item.sourceId, item.name, item.relatedIds, 'org');
          }
        }

        // Scan OrgSelection by identical Name
        const nameGroupsOrg = await OrgSelection.aggregate([
          { $group: { _id: "$name", ids: { $push: "$sourceId" }, count: { $sum: 1 } } },
          { $match: { count: { $gte: 2 } } }
        ]);
        for (const group of nameGroupsOrg) {
          if (group._id && group._id.trim() !== '') {
            await handleDuplicate(group.ids[0], group._id, group.ids.slice(1), 'org');
          }
        }
        
        // Recover missing duplicates
        await recoverMissingDuplicates();
        
        // Rebuild entries + price info cho tất cả
        await rebuildAllDuplicateEntries();
        
        console.log('[TRIGGER] Full duplicate scan and recovery completed.');
      } catch (err) {
        console.error('[TRIGGER] Error in duplicate scan:', err);
      }
    })();
    
    res.json({ success: true, message: 'Đã bắt đầu quét và cập nhật lại nhóm trùng lặp toàn bộ Database.' });
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
