const { Router } = require('express');
const Duplicate = require('../models/Duplicate');

const router = Router();

function buildLatestNoticeLookupStages() {
  return [
    {
      $addFields: {
        latestSourceId: {
          $arrayElemAt: ['$sourceIds', -1],
        },
        _latestPublishedAt: {
          $arrayElemAt: [{ $slice: ['$entries.publishedAt', -1] }, 0],
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
      dupFilter.name = { $regex: req.query.search, $options: 'i' };
    }

    const sortMap = {
      rounds_desc: { relistCount: -1, _latestPublishedAt: -1 },
      newest: { _latestPublishedAt: -1 },
      price_asc: { latestPrice: 1 },
      discount_pct: { priceDropPercent: -1 },
    };
    const sortKey = req.query.sort || 'newest';

    const hasNoticeFilters = Boolean(
      (req.query.province && req.query.province !== 'all')
        || (req.query.type && req.query.type !== 'all')
        || (req.query.organizer && req.query.organizer !== 'all')
        || req.query.maxPrice
    );

    const baseStages = [
      { $match: dupFilter },
      {
        $addFields: {
          _latestPublishedAt: {
            $arrayElemAt: [{ $slice: ['$entries.publishedAt', -1] }, 0],
          },
        },
      },
    ];

    const sortStage = { $sort: sortMap[sortKey] || sortMap.rounds_desc };

    if (!hasNoticeFilters) {
      const pipeline = [
        ...baseStages,
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              sortStage,
              { $skip: skip },
              { $limit: limit },
              ...buildLatestNoticeLookupStages(),
              {
                $match: {
                  latestNotice: { $ne: null },
                },
              },
              {
                $project: {
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
                },
              },
            ],
          },
        },
      ];

      const result = await Duplicate.aggregate(pipeline);
      const total = result[0]?.metadata?.[0]?.total || 0;
      const items = result[0]?.data || [];

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

    const pipeline = [
      ...baseStages,
      ...buildLatestNoticeLookupStages(),
    ];

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
      noticeMatch['latestNotice.organizer'] = { $regex: req.query.organizer, $options: 'i' };
    }
    if (req.query.maxPrice) {
      noticeMatch.latestPrice = { $lte: parseFloat(req.query.maxPrice) };
    }

    pipeline.push({ $match: noticeMatch });
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          sortStage,
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
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
            },
          },
        ],
      },
    });

    const result = await Duplicate.aggregate(pipeline);
    const total = result[0]?.metadata?.[0]?.total || 0;
    const items = result[0]?.data || [];

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

/**
 * GET /api/relisted/filters
 * Lấy các options để filter (province, type) dựa trên tập data đã relisted
 */
router.get('/filters', async (req, res, next) => {
  try {
    const pipeline = [
      {
        $match: {
          type: 'auction',
          relistCount: { $gt: 1 },
        },
      },
      ...buildLatestNoticeLookupStages(),
      {
        $match: {
          latestNotice: { $ne: null },
        },
      },
      {
        $facet: {
          provinces: [
            { $group: { _id: '$latestNotice.province', count: { $sum: 1 } } },
            { $match: { _id: { $ne: null }, count: { $gt: 0 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          types: [
            { $group: { _id: '$latestNotice.type', count: { $sum: 1 } } },
            { $match: { _id: { $ne: null }, count: { $gt: 0 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
        },
      },
    ];

    const results = await Duplicate.aggregate(pipeline);
    const filters = results[0] || { provinces: [], types: [] };

    res.json({
      provinces: (filters.provinces || []).map((p) => p._id).filter(Boolean),
      types: (filters.types || []).map((t) => t._id).filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
