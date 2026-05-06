const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const Duplicate = require('../models/Duplicate');

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

function buildLatestNoticeLookupStages() {
  return [
    {
      $addFields: {
        latestSourceId: {
          $arrayElemAt: ['$sourceIds', -1],
        },
        _reducedAmt: { $subtract: ['$firstPrice', '$latestPrice'] },
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
 * GET /api/discounted?page=1&limit=20&type=land&province=...&minDiscount=20&maxPrice=5000000000&sort=discount_pct&search=keyword&organizer=...&minRounds=2
 * Danh sách tài sản giảm giá với filter/sort/pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const dupFilter = {
      isPriceDrop: true,
      type: 'auction',
      priceDropPercent: { $gt: 0 },
      $expr: { $lt: ['$latestPrice', '$firstPrice'] },
    };
    if (req.query.search) {
      dupFilter.name = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.minDiscount) {
      dupFilter.priceDropPercent = { $gte: parseFloat(req.query.minDiscount) };
    }
    if (req.query.minRounds) {
      dupFilter.relistCount = { $gte: parseInt(req.query.minRounds, 10) };
    }

    const sortMap = {
      discount_pct: { priceDropPercent: -1 },
      discount_amt: { _reducedAmt: -1 },
      newest: { _latestPublishedAt: -1 },
      price_asc: { latestPrice: 1 },
      rounds_desc: { relistCount: -1 },
    };
    const sortKey = req.query.sort || 'discount_pct';

    const pipeline = [
      { $match: dupFilter },
      ...buildLatestNoticeLookupStages(),
    ];

    const postFilter = {
      latestNotice: { $ne: null },
    };
    const provinceFilter = buildProvinceFilter(req.query.province);
    if (provinceFilter) {
      postFilter['latestNotice.province'] = provinceFilter;
    }
    if (req.query.type) {
      postFilter['latestNotice.type'] = req.query.type;
    }
    if (req.query.organizer) {
      postFilter['latestNotice.organizer'] = { $regex: req.query.organizer, $options: 'i' };
    }
    if (req.query.maxPrice) {
      postFilter.latestPrice = { $lte: parseInt(req.query.maxPrice, 10) };
    }

    pipeline.push({ $match: postFilter });

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: sortMap[sortKey] || sortMap.discount_pct },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              name: 1,
              firstPrice: 1,
              latestPrice: 1,
              priceDropPercent: 1,
              relistCount: 1,
              reducedAmount: '$_reducedAmt',
              updatedAt: 1,
              sourceId: '$latestNotice.sourceId',
              type: '$latestNotice.type',
              province: '$latestNotice.province',
              district: '$latestNotice.district',
              organizer: '$latestNotice.organizer',
              owner: '$latestNotice.owner',
              publishedAt: '$latestNotice.publishedAt',
              auctionDate: '$latestNotice.auctionDate',
              status: '$latestNotice.status',
              initialPrice: '$firstPrice',
              currentPrice: '$latestPrice',
              sourceUrl: '$latestNotice.sourceUrl',
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
 * GET /api/discounted/filters
 * Lấy danh sách options cho bộ lọc (provinces, organizers, types)
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
