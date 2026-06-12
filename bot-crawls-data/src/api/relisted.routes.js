const { Router } = require('express');
const Duplicate = require('../models/Duplicate');

const router = Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLatestNoticeLookupStages() {
  return [
    {
      $addFields: {
        latestSourceId: {
          $arrayElemAt: [{ $ifNull: ['$sourceIds', []] }, -1],
        },
        _latestPublishedAt: {
          $arrayElemAt: [{ $slice: [{ $ifNull: ['$entries.publishedAt', []] }, -1] }, 0],
        },
      },
    },
    {
      $lookup: {
        from: 'auctionnotices',
        localField: 'latestSourceId',
        foreignField: 'sourceId',
        as: 'latestNoticeLookup',
      },
    },
    {
      $addFields: {
        latestNotice: {
          $arrayElemAt: ['$latestNoticeLookup', 0],
        },
      },
    },
    {
      $project: {
        latestNoticeLookup: 0,
      },
    },
  ];
}

/**
 * GET /api/relisted?page=1&limit=20&type=land&province=...&maxPrice=5000000000&sort=rounds_desc&search=keyword&organizer=...
 * Danh sách tài sản đăng lại nhiều lần với filter/sort/pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const dupFilter = {
      type: 'auction',
      relistCount: { $gt: 1 },
    };

    if (req.query.search) {
      dupFilter.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
    }

    const sortMap = {
      rounds_desc: { relistCount: -1, lastPublishedAt: -1 },
      newest: { lastPublishedAt: -1 },
      price_asc: { latestPrice: 1 },
      discount_pct: { priceDropPercent: -1 },
    };
    const sortKey = req.query.sort || 'newest';
    const sortStage = { $sort: sortMap[sortKey] || sortMap.rounds_desc };

    const hasNoticeFilters = Boolean(
      (req.query.province && req.query.province !== 'all')
        || (req.query.type && req.query.type !== 'all')
        || (req.query.organizer && req.query.organizer !== 'all')
        || (req.query.status && req.query.status !== 'all')
        || req.query.maxPrice
        || req.query.auctionDateFrom
        || req.query.auctionDateTo
        || req.query.publishedAtFrom
        || req.query.publishedAtTo
    );

    const baseProject = {
      _id: 1,
      name: 1,
      shortDescription: '$latestNotice.shortDescription',
      firstPrice: 1,
      latestPrice: 1,
      priceDropPercent: 1,
      relistCount: 1,
      updatedAt: 1,
      sourceId: '$latestNotice.sourceId',
      type: '$latestNotice.type',
      province: '$latestNotice.province',
      organizer: '$latestNotice.organizer',
      publishedAt: '$latestNotice.publishedAt',
      auctionDate: '$latestNotice.auctionDate',
      registrationStart: '$latestNotice.registrationStart',
      registrationEnd: '$latestNotice.registrationEnd',
      status: '$latestNotice.status',
      initialPrice: '$firstPrice',
      currentPrice: '$latestPrice',
      publishRound: '$relistCount',
    };

    if (!hasNoticeFilters) {
      // Tối ưu khi không có filter phức tạp liên quan đến bảng join
      const [total, items] = await Promise.all([
        Duplicate.countDocuments(dupFilter),
        Duplicate.aggregate([
          { $match: dupFilter },
          sortStage,
          { $skip: skip },
          { $limit: limit },
          ...buildLatestNoticeLookupStages(),
          {
            $match: {
              latestNotice: { $ne: null },
            },
          },
          { $project: baseProject },
        ]).allowDiskUse(true)
      ]);

      res.json({
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
      return;
    }

    // Khi có filter phức tạp, tối ưu bằng cách truy vấn AuctionNotice trước để lấy sourceIds
    const noticeMatchQuery = {};
    if (req.query.province && req.query.province !== 'all') {
      noticeMatchQuery.province = req.query.province;
    }
    if (req.query.type && req.query.type !== 'all') {
      noticeMatchQuery.type = req.query.type;
    }
    if (req.query.organizer && req.query.organizer !== 'all') {
      noticeMatchQuery.organizer = { $regex: escapeRegex(req.query.organizer), $options: 'i' };
    }
    if (req.query.status && req.query.status !== 'all') {
      noticeMatchQuery.status = req.query.status;
    }
    if (req.query.maxPrice) {
      noticeMatchQuery.currentPrice = { $lte: parseFloat(req.query.maxPrice) };
    }
    if (req.query.auctionDateFrom || req.query.auctionDateTo) {
      noticeMatchQuery.auctionDate = {};
      if (req.query.auctionDateFrom) noticeMatchQuery.auctionDate.$gte = new Date(req.query.auctionDateFrom);
      if (req.query.auctionDateTo) noticeMatchQuery.auctionDate.$lte = new Date(req.query.auctionDateTo);
    }
    if (req.query.publishedAtFrom || req.query.publishedAtTo) {
      noticeMatchQuery.publishedAt = {};
      if (req.query.publishedAtFrom) noticeMatchQuery.publishedAt.$gte = new Date(req.query.publishedAtFrom);
      if (req.query.publishedAtTo) noticeMatchQuery.publishedAt.$lte = new Date(req.query.publishedAtTo);
    }

    const matchingNotices = await require('../models/AuctionNotice').find(noticeMatchQuery).select('sourceId').lean();
    const noticeSourceIds = matchingNotices.map(n => n.sourceId);

    // Nếu không có notice nào thỏa mãn, trả về 0 kết quả luôn
    if (noticeSourceIds.length === 0) {
      return res.json({ items: [], pagination: { total: 0, page, limit, totalPages: 0 } });
    }

    // Lọc Duplicate theo những sourceIds vừa tìm được
    dupFilter.sourceIds = { $in: noticeSourceIds };

    // Vẫn giữ lookup và noticeMatch để đảm bảo _latestNotice_ mới thỏa mãn điều kiện
    // (tránh trường hợp notice cũ thỏa mãn nhưng notice mới thì không)
    const noticeMatch = {
      latestNotice: { $ne: null },
    };

    if (req.query.province && req.query.province !== 'all') {
      noticeMatch['latestNotice.province'] = req.query.province;
    }
    if (req.query.type && req.query.type !== 'all') {
      noticeMatch['latestNotice.type'] = req.query.type;
    }
    if (req.query.organizer && req.query.organizer !== 'all') {
      noticeMatch['latestNotice.organizer'] = { $regex: escapeRegex(req.query.organizer), $options: 'i' };
    }
    if (req.query.status && req.query.status !== 'all') {
      noticeMatch['latestNotice.status'] = req.query.status;
    }
    if (req.query.maxPrice) {
      noticeMatch.latestPrice = { $lte: parseFloat(req.query.maxPrice) };
    }
    if (req.query.auctionDateFrom || req.query.auctionDateTo) {
      noticeMatch['latestNotice.auctionDate'] = {};
      if (req.query.auctionDateFrom) noticeMatch['latestNotice.auctionDate'].$gte = new Date(req.query.auctionDateFrom);
      if (req.query.auctionDateTo) noticeMatch['latestNotice.auctionDate'].$lte = new Date(req.query.auctionDateTo);
    }
    if (req.query.publishedAtFrom || req.query.publishedAtTo) {
      noticeMatch['latestNotice.publishedAt'] = {};
      if (req.query.publishedAtFrom) noticeMatch['latestNotice.publishedAt'].$gte = new Date(req.query.publishedAtFrom);
      if (req.query.publishedAtTo) noticeMatch['latestNotice.publishedAt'].$lte = new Date(req.query.publishedAtTo);
    }

    const filterPipeline = [
      { $match: dupFilter },
      ...buildLatestNoticeLookupStages(),
      { $match: noticeMatch }
    ];

    const [totalResult, items] = await Promise.all([
      Duplicate.aggregate([...filterPipeline, { $count: 'total' }]),
      Duplicate.aggregate([
        ...filterPipeline,
        sortStage,
        { $skip: skip },
        { $limit: limit },
        { $project: baseProject },
      ]).allowDiskUse(true)
    ]);

    const total = totalResult[0]?.total || 0;

    res.json({
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

const AuctionNotice = require('../models/AuctionNotice');

/**
 * GET /api/relisted/filters
 * Lấy các options để filter (province, type, organizer)
 */
router.get('/filters', async (req, res, next) => {
  try {
    const [provinces, organizers, types] = await Promise.all([
      AuctionNotice.distinct('province', { province: { $ne: '' } }),
      AuctionNotice.distinct('organizer', { organizer: { $ne: '' } }),
      AuctionNotice.distinct('type'),
    ]);

    res.json({
      provinces: provinces.filter(Boolean).sort(),
      organizers: organizers.filter(Boolean).sort(),
      types: types.filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
