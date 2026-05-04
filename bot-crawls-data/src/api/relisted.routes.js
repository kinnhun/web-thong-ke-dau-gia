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
      rounds_desc: { relistCount: -1, _latestPublishedAt: -1 },
      newest: { _latestPublishedAt: -1 },
      price_asc: { latestPrice: 1 },
      discount_pct: { priceDropPercent: -1 },
    };
    const sortKey = req.query.sort || 'newest';
    const sortStage = { $sort: sortMap[sortKey] || sortMap.rounds_desc };

    const hasNoticeFilters = Boolean(
      (req.query.province && req.query.province !== 'all')
        || (req.query.type && req.query.type !== 'all')
        || (req.query.organizer && req.query.organizer !== 'all')
        || req.query.maxPrice
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
      status: '$latestNotice.status',
      initialPrice: '$latestNotice.initialPrice',
      currentPrice: '$latestNotice.currentPrice',
    };

    if (!hasNoticeFilters) {
      // Tối ưu khi không có filter phức tạp liên quan đến bảng join
      const [total, items] = await Promise.all([
        Duplicate.countDocuments(dupFilter),
        Duplicate.aggregate([
          { $match: dupFilter },
          {
            $addFields: {
              _latestPublishedAt: {
                $arrayElemAt: [{ $slice: [{ $ifNull: ['$entries.publishedAt', []] }, -1] }, 0],
              },
            },
          },
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

    // Khi có filter phức tạp, bắt buộc phải lookup trước
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
    if (req.query.maxPrice) {
      noticeMatch.latestPrice = { $lte: parseFloat(req.query.maxPrice) };
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
