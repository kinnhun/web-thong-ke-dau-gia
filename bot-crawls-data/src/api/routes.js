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

router.get('/auctions/stats', async (req, res, next) => {
  try {
    const [total, byType, byProvince, byStatus, recentCount, totalAuctionDuplicates, totalOrgDuplicates] = await Promise.all([
      AuctionNotice.countDocuments(),
      AuctionNotice.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      AuctionNotice.aggregate([
        { $match: { province: { $ne: '' } } },
        { $group: { _id: '$province', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 20 },
      ]),
      AuctionNotice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      AuctionNotice.countDocuments({ publishedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      Duplicate.countDocuments({ type: 'auction' }),
      Duplicate.countDocuments({ type: 'org' }),
    ]);
    res.json({
      total, recentCount, 
      totalAuctionDuplicates, totalOrgDuplicates,
      byType: byType.map(t => ({ type: t._id, count: t.count })),
      byProvince: byProvince.map(p => ({ province: p._id, count: p.count })),
      byStatus: byStatus.map(s => ({ status: s._id, count: s.count })),
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

    res.json({
      ...transformAuction(item),
      relatedItems: relatedItems.map(r => ({
        id: r._id.toString(), sourceId: r.sourceId, name: r.name,
        initialPrice: r.initialPrice || 0, publishRound: r.publishRound || 1,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : '',
      })),
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
    res.json(item);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════
// DUPLICATES
// ═══════════════════════════════════

router.get('/duplicates', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.search) filter.name = { $regex: req.query.search, $options: 'i' };
    const [rawItems, total] = await Promise.all([
      Duplicate.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Duplicate.countDocuments(filter),
    ]);
    
    // Nạp chi tiết các bài thông báo cho từng nhóm
    const items = await Promise.all(rawItems.map(async (dup) => {
      let notices = [];
      if (dup.type === 'org') {
        notices = await OrgSelection.find({ sourceId: { $in: dup.sourceIds || [] } })
          .select('sourceId name startingPrice publishRound sourceUrl publishedAt status')
          .sort({ publishRound: 1 })
          .lean();
        notices.forEach(n => { n.initialPrice = n.startingPrice; }); // Chuẩn hóa name để dùng chung UI
      } else {
        notices = await AuctionNotice.find({ sourceId: { $in: dup.sourceIds || [] } })
          .select('sourceId name initialPrice publishRound sourceUrl publishedAt status')
          .sort({ publishRound: 1 })
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

      const prices = notices.map(n => n.initialPrice).filter(Boolean);
      const uniquePrices = [...new Set(prices)];
      const isPriceDrop = uniquePrices.length > 1;

      return {
        ...dup,
        notices,
        isPriceDrop,
      };
    }));

    res.json({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
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
    const { handleDuplicate } = require('../scrapers/detail.scraper');
    
    // Run in background
    (async () => {
      try {
        console.log('[TRIGGER] Starting full duplicate scan...');
        const { recoverMissingDuplicates } = require('../scrapers/detail.scraper');
        
        // Scan AuctionNotice
        const auctions = await AuctionNotice.find({ relatedIds: { $exists: true, $not: { $size: 0 } } }).select('sourceId name relatedIds');
        for (const item of auctions) {
          if (item.relatedIds && item.relatedIds.length > 0) {
            await handleDuplicate(item.sourceId, item.name, item.relatedIds, 'auction');
          }
        }
        
        // Scan OrgSelection
        const orgs = await OrgSelection.find({ relatedIds: { $exists: true, $not: { $size: 0 } } }).select('sourceId name relatedIds');
        for (const item of orgs) {
          if (item.relatedIds && item.relatedIds.length > 0) {
            await handleDuplicate(item.sourceId, item.name, item.relatedIds, 'org');
          }
        }
        
        // Recover missing duplicates
        await recoverMissingDuplicates();
        
        console.log('[TRIGGER] Full duplicate scan and recovery completed.');
      } catch (err) {
        console.error('[TRIGGER] Error in duplicate scan:', err);
      }
    })();
    
    res.json({ success: true, message: 'Đã bắt đầu quét và cập nhật lại nhóm trùng lặp toàn bộ Database.' });
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
  };
}

module.exports = router;
