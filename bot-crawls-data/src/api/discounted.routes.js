const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const Duplicate = require('../models/Duplicate');

const router = Router();

/**
 * GET /api/discounted?page=1&limit=20&type=land&province=...&minDiscount=20&maxPrice=5000000000&sort=discount_pct&search=keyword&organizer=...&minRounds=2
 * Danh sách tài sản giảm giá với filter/sort/pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter trên Duplicate
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
      dupFilter.relistCount = { $gte: parseInt(req.query.minRounds) };
    }

    // Sort mapping
    const sortMap = {
      discount_pct: { priceDropPercent: -1 },
      discount_amt: { _reducedAmt: -1 }, // computed below
      newest: { _latestPublishedAt: -1 },
      price_asc: { latestPrice: 1 },
      rounds_desc: { relistCount: -1 },
    };
    const sortKey = req.query.sort || 'discount_pct';

    // Build aggregation pipeline
    const pipeline = [
      { $match: dupFilter },
    ];

    // Add computed fields for sorting
    pipeline.push({
      $addFields: {
        _reducedAmt: { $subtract: ['$firstPrice', '$latestPrice'] },
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

    pipeline.push({
      $addFields: {
        latestNotice: {
          $arrayElemAt: [
            { $sortArray: { input: '$notices', sortBy: { publishedAt: -1 } } },
            0,
          ],
        },
      },
    });

    // Post-lookup filters (province, type, organizer, maxPrice)
    const postFilter = {};
    if (req.query.province) {
      postFilter['latestNotice.province'] = { $regex: req.query.province, $options: 'i' };
    }
    if (req.query.type) {
      postFilter['latestNotice.type'] = req.query.type;
    }
    if (req.query.organizer) {
      postFilter['latestNotice.organizer'] = { $regex: req.query.organizer, $options: 'i' };
    }
    if (req.query.maxPrice) {
      postFilter.latestPrice = { $lte: parseInt(req.query.maxPrice) };
    }

    if (Object.keys(postFilter).length > 0) {
      pipeline.push({ $match: postFilter });
    }

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];

    // Sort + paginate
    const sort = sortMap[sortKey] || sortMap.discount_pct;
    pipeline.push({ $sort: sort });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Project final fields
    pipeline.push({
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
        initialPrice: '$latestNotice.initialPrice',
        currentPrice: '$latestNotice.currentPrice',
        sourceUrl: '$latestNotice.sourceUrl',
      },
    });

    const [items, countResult] = await Promise.all([
      Duplicate.aggregate(pipeline),
      Duplicate.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total || 0;

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
