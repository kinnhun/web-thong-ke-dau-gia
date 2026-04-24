const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const Duplicate = require('../models/Duplicate');

const router = Router();

/**
 * GET /api/relisted?page=1&limit=20&type=land&province=...&maxPrice=5000000000&sort=rounds_desc&search=keyword&organizer=...
 * Danh sách tài sản đăng lại nhiều lần với filter/sort/pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter trên Duplicate
    const dupFilter = {
      type: 'auction',
      relistCount: { $gt: 1 },
    };
    if (req.query.search) {
      dupFilter.name = { $regex: req.query.search, $options: 'i' };
    }

    // Sort mapping
    const sortMap = {
      rounds_desc: { relistCount: -1, _latestPublishedAt: -1 },
      newest: { _latestPublishedAt: -1 },
      price_asc: { latestPrice: 1 },
      discount_pct: { priceDropPercent: -1 },
    };
    const sortKey = req.query.sort || 'rounds_desc';

    // Build aggregation pipeline
    const pipeline = [
      { $match: dupFilter },
    ];

    // Add computed fields for sorting
    pipeline.push({
      $addFields: {
        _latestPublishedAt: { $arrayElemAt: [{ $slice: ['$entries.publishedAt', -1] }, 0] },
      },
    });

    // Lookup auction notices to get province, type, organizer
    pipeline.push({
      $lookup: {
        from: 'auctionnotices',
        localField: 'sourceIds',
        foreignField: 'sourceId',
        as: 'notices',
      },
    });

    // Determine latest notice to extract metadata
    pipeline.push({
      $addFields: {
        latestNotice: {
          $arrayElemAt: [
            {
              $sortArray: {
                input: '$notices',
                sortBy: { publishedAt: -1 },
              },
            },
            0,
          ],
        },
      },
    });

    // Filter by latest notice fields
    const noticeMatch = {};
    if (req.query.province && req.query.province !== 'all') {
      noticeMatch['latestNotice.province'] = req.query.province;
    }
    if (req.query.type && req.query.type !== 'all') {
      noticeMatch['latestNotice.type'] = req.query.type;
    }
    if (req.query.organizer) {
      noticeMatch['latestNotice.organizer'] = req.query.organizer;
    }
    if (req.query.maxPrice) {
      noticeMatch['latestPrice'] = { $lte: parseFloat(req.query.maxPrice) };
    }

    if (Object.keys(noticeMatch).length > 0) {
      pipeline.push({ $match: noticeMatch });
    }

    // Facet for pagination & count
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: sortMap[sortKey] || sortMap.rounds_desc },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: 1,
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
    const total = result[0].metadata[0]?.total || 0;
    const items = result[0].data;

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
      {
        $lookup: {
          from: 'auctionnotices',
          localField: 'sourceIds',
          foreignField: 'sourceId',
          as: 'notices',
        },
      },
      {
        $addFields: {
          latestNotice: {
            $arrayElemAt: [
              {
                $sortArray: {
                  input: '$notices',
                  sortBy: { publishedAt: -1 },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $facet: {
          provinces: [
            { $group: { _id: '$latestNotice.province', count: { $sum: 1 } } },
            { $match: { _id: { $ne: null }, count: { $gt: 0 } } },
            { $sort: { count: -1 } },
          ],
          types: [
            { $group: { _id: '$latestNotice.type', count: { $sum: 1 } } },
            { $match: { _id: { $ne: null }, count: { $gt: 0 } } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ];

    const results = await Duplicate.aggregate(pipeline);
    const filters = results[0];

    res.json({
      provinces: filters.provinces.map((p) => p._id).filter(Boolean),
      types: filters.types.map((t) => t._id).filter(Boolean),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
