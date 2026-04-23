const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const CrawlLog = require('../models/CrawlLog');

const router = Router();

// ═══════════════════════════════════
// AUCTION NOTICES
// ═══════════════════════════════════

/**
 * GET /api/auctions
 * Danh sách đấu giá với filter + pagination
 *
 * Query params:
 *   page (default: 1)
 *   limit (default: 20, max: 100)
 *   type - AssetType filter
 *   province - Tỉnh/thành phố
 *   status - Trạng thái
 *   organizer - Tổ chức đấu giá
 *   owner - Người có tài sản
 *   search - Full-text search
 *   minPrice - Giá tối thiểu
 *   maxPrice - Giá tối đa
 *   fromDate - Từ ngày (ISO)
 *   toDate - Đến ngày (ISO)
 *   sort - Sắp xếp (publishedAt, auctionDate, currentPrice, initialPrice)
 *   order - asc/desc (default: desc)
 */
router.get('/auctions', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};

    if (req.query.type) filter.type = req.query.type;
    if (req.query.province) filter.province = { $regex: req.query.province, $options: 'i' };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.organizer) filter.organizer = { $regex: req.query.organizer, $options: 'i' };
    if (req.query.owner) filter.owner = { $regex: req.query.owner, $options: 'i' };
    if (req.query.propertyTypeName) filter.propertyTypeName = { $regex: req.query.propertyTypeName, $options: 'i' };

    // Full text search
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // Price range
    if (req.query.minPrice || req.query.maxPrice) {
      filter.currentPrice = {};
      if (req.query.minPrice) filter.currentPrice.$gte = parseInt(req.query.minPrice);
      if (req.query.maxPrice) filter.currentPrice.$lte = parseInt(req.query.maxPrice);
    }

    // Date range
    if (req.query.fromDate || req.query.toDate) {
      filter.publishedAt = {};
      if (req.query.fromDate) filter.publishedAt.$gte = new Date(req.query.fromDate);
      if (req.query.toDate) filter.publishedAt.$lte = new Date(req.query.toDate);
    }

    // Sort
    const sortField = req.query.sort || 'publishedAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    const [items, total] = await Promise.all([
      AuctionNotice.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      AuctionNotice.countDocuments(filter),
    ]);

    // Transform items to match Auction interface
    const data = items.map(transformAuction);

    res.json({
      items: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auctions/stats
 * Thống kê tổng quan
 */
router.get('/auctions/stats', async (req, res, next) => {
  try {
    const [total, byType, byProvince, byStatus, recentCount] = await Promise.all([
      AuctionNotice.countDocuments(),
      AuctionNotice.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuctionNotice.aggregate([
        { $match: { province: { $ne: '' } } },
        { $group: { _id: '$province', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      AuctionNotice.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      AuctionNotice.countDocuments({
        publishedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    res.json({
      total,
      recentCount,
      byType: byType.map(t => ({ type: t._id, count: t.count })),
      byProvince: byProvince.map(p => ({ province: p._id, count: p.count })),
      byStatus: byStatus.map(s => ({ status: s._id, count: s.count })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auctions/:id
 * Chi tiết 1 thông báo đấu giá
 */
router.get('/auctions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm theo _id hoặc sourceId
    let item;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      item = await AuctionNotice.findById(id).lean();
    } else {
      item = await AuctionNotice.findOne({ sourceId: parseInt(id) }).lean();
    }

    if (!item) {
      return res.status(404).json({ error: true, message: 'Không tìm thấy thông báo đấu giá' });
    }

    res.json(transformAuction(item));
  } catch (err) {
    next(err);
  }
});


// ═══════════════════════════════════
// ORG SELECTIONS
// ═══════════════════════════════════

/**
 * GET /api/org-selections
 * Danh sách lựa chọn tổ chức đấu giá
 */
router.get('/org-selections', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) filter.$text = { $search: req.query.search };
    if (req.query.province) filter.province = { $regex: req.query.province, $options: 'i' };
    if (req.query.owner) filter.owner = { $regex: req.query.owner, $options: 'i' };

    if (req.query.fromDate || req.query.toDate) {
      filter.publishedAt = {};
      if (req.query.fromDate) filter.publishedAt.$gte = new Date(req.query.fromDate);
      if (req.query.toDate) filter.publishedAt.$lte = new Date(req.query.toDate);
    }

    const sort = { publishedAt: -1 };

    const [items, total] = await Promise.all([
      OrgSelection.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      OrgSelection.countDocuments(filter),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/org-selections/:id
 * Chi tiết 1 thông báo lựa chọn tổ chức
 */
router.get('/org-selections/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let item;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      item = await OrgSelection.findById(id).lean();
    } else {
      item = await OrgSelection.findOne({ sourceId: parseInt(id) }).lean();
    }

    if (!item) {
      return res.status(404).json({ error: true, message: 'Không tìm thấy' });
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});


// ═══════════════════════════════════
// FILTERS & META
// ═══════════════════════════════════

/**
 * GET /api/filters
 * Lấy danh sách options cho filter
 */
router.get('/filters', async (req, res, next) => {
  try {
    const [provinces, organizers, owners, types] = await Promise.all([
      AuctionNotice.distinct('province').then(arr => arr.filter(Boolean).sort()),
      AuctionNotice.distinct('organizer').then(arr => arr.filter(Boolean).sort()),
      AuctionNotice.distinct('owner').then(arr => arr.filter(Boolean).sort()),
      AuctionNotice.distinct('type'),
    ]);

    const assetTypeLabel = {
      land: 'Quyền sử dụng đất',
      house: 'Nhà ở',
      car: 'Ô tô',
      machinery: 'Máy móc thiết bị',
      enforcement: 'Tài sản thi hành án',
      public: 'Tài sản công',
      other: 'Khác',
    };

    const statusLabel = {
      upcoming: 'Sắp đấu giá',
      receiving_docs: 'Đang nhận hồ sơ',
      newly_reduced: 'Mới giảm giá',
      watch: 'Cần theo dõi',
      completed: 'Đã kết thúc',
      unknown: 'Chưa xác định',
    };

    res.json({
      provinces,
      organizers,
      owners,
      types: types.map(t => ({ value: t, label: assetTypeLabel[t] || t })),
      statuses: Object.entries(statusLabel).map(([value, label]) => ({ value, label })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/crawl-logs
 * Xem lịch sử crawl
 */
router.get('/crawl-logs', async (req, res, next) => {
  try {
    const logs = await CrawlLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});


// ═══════════════════════════════════
// HELPERS
// ═══════════════════════════════════

/**
 * Transform DB document → Auction interface (match mockAuctions.ts)
 */
function transformAuction(doc) {
  return {
    id: doc._id.toString(),
    sourceId: doc.sourceId,
    groupId: `group-${doc.sourceId}`,
    name: doc.name || '',
    shortDescription: doc.shortDescription || '',
    type: doc.type || 'other',
    province: doc.province || '',
    district: doc.district || '',
    address: doc.address || '',
    initialPrice: doc.initialPrice || 0,
    currentPrice: doc.currentPrice || doc.initialPrice || 0,
    deposit: doc.deposit || 0,
    depositPercent: doc.depositPercent || '',
    applicationFee: doc.applicationFee || 0,
    rounds: doc.rounds || 1,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : '',
    auctionDate: doc.auctionDate ? doc.auctionDate.toISOString() : '',
    applicationDeadline: doc.registrationEnd ? doc.registrationEnd.toISOString() : '',
    registrationStart: doc.registrationStart ? doc.registrationStart.toISOString() : '',
    registrationEnd: doc.registrationEnd ? doc.registrationEnd.toISOString() : '',
    status: doc.status || 'unknown',
    organizer: doc.organizer || '',
    owner: doc.owner || '',
    sourceUrl: doc.sourceUrl || '',
    quality: doc.quality || doc.propertyTypeName || '',
    propertyTypeName: doc.propertyTypeName || '',
    propertyAmount: doc.propertyAmount || '',
    conditions: doc.conditions || '',
    history: doc.history || [],
    isDuplicateSuspect: doc.isDuplicateSuspect || false,
  };
}

// ═══════════════════════════════════
// MANUAL TRIGGERS
// ═══════════════════════════════════
router.post('/trigger-detail-crawl', async (req, res, next) => {
  try {
    const { crawlDetails, crawlOrgDetails } = require('../scrapers/detail.scraper');
    const limit = parseInt(req.body?.limit) || 30;
    
    // Chạy ngầm không chờ để tránh block request
    (async () => {
      try {
        console.log(`[MANUAL TRIGGER] Bắt đầu cào chi tiết (${limit} items)...`);
        await crawlDetails({ maxItems: limit });
        await crawlOrgDetails({ maxItems: limit });
        console.log('[MANUAL TRIGGER] Cào chi tiết hoàn tất!');
      } catch (err) {
        console.error('[MANUAL TRIGGER] Lỗi:', err);
      }
    })();

    res.json({ success: true, message: `Đã kích hoạt cào chi tiết chạy ngầm (tối đa ${limit} items mỗi loại).` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
