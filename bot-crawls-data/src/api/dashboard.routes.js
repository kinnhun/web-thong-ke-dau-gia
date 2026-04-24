const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');

const router = Router();

// ⚡ Simple in-memory cache (60s TTL)
const cache = new Map();
function cached(key, ttlMs, fn) {
  return async (req, res, next) => {
    const cacheKey = key + (req.url || '');
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.ts < ttlMs) {
      return res.json(hit.data);
    }
    try {
      const data = await fn(req);
      cache.set(cacheKey, { data, ts: Date.now() });
      res.json(data);
    } catch (err) { next(err); }
  };
}

/**
 * GET /api/dashboard/stats
 * KPI tổng hợp cho trang Dashboard
 */
router.get('/stats', cached('dashboard-stats', 60000, async () => {
  const now = new Date();
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalAuctions,
    totalOrg,
    recentCount,
    newIn72h,
    byType,
    byProvince,
    byStatus,
    discountStats,
    maxDiscountDoc,
  ] = await Promise.all([
    AuctionNotice.countDocuments(),
    OrgSelection.countDocuments(),
    AuctionNotice.countDocuments({ publishedAt: { $gte: sevenDaysAgo } }),
    AuctionNotice.countDocuments({ publishedAt: { $gte: threeDaysAgo } }),
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
    Duplicate.aggregate([
       {
        $match: {
          isPriceDrop: true,
          type: 'auction',
          priceDropPercent: { $gt: 0 },
          $expr: { $lt: ['$latestPrice', '$firstPrice'] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          maxPct: { $max: '$priceDropPercent' },
          totalReduced: {
            $sum: { $subtract: ['$firstPrice', '$latestPrice'] },
          },
        },
      },
    ]),
    Duplicate.aggregate([
      {
        $match: {
          isPriceDrop: true,
          type: 'auction',
          priceDropPercent: { $gt: 0 },
          $expr: { $lt: ['$latestPrice', '$firstPrice'] },
        },
      },
      { $sort: { priceDropPercent: -1 } },
      { $limit: 1 },
      { $project: { name: 1, priceDropPercent: 1, sourceIds: 1 } },
    ]).then((docs) => docs[0] || null),
  ]);

  const ds = discountStats[0] || { count: 0, maxPct: 0, totalReduced: 0 };

  return {
    totalAuctions,
    totalOrg,
    recentCount,
    newIn72h,
    totalDiscounted: ds.count,
    maxDiscountPercent: ds.maxPct || 0,
    maxDiscountItem: maxDiscountDoc
      ? { name: maxDiscountDoc.name, sourceId: maxDiscountDoc.sourceIds?.[0] }
      : null,
    totalReducedValue: ds.totalReduced || 0,
    byType: byType.map((t) => ({ type: t._id, count: t.count })),
    byProvince: byProvince.map((p) => ({ province: p._id, count: p.count })),
    byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
  };
}));

/**
 * GET /api/dashboard/trend?days=14
 * Xu hướng giảm giá theo ngày
 */
router.get('/trend', async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 14));
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const trend = await Duplicate.aggregate([
      {
        $match: {
          isPriceDrop: true,
          type: 'auction',
          priceDropPercent: { $gt: 0 },
          $expr: { $lt: ['$latestPrice', '$firstPrice'] },
        },
      },
      // Lấy publishedAt từ entry cuối cùng (lần đăng mới nhất)
      {
        $addFields: {
          latestPublishedAt: { $arrayElemAt: [{ $slice: ['$entries.publishedAt', -1] }, 0] },
        },
      },
      { $match: { latestPublishedAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$latestPublishedAt' } },
          count: { $sum: 1 },
          avgDiscount: { $avg: '$priceDropPercent' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
          avgDiscount: { $round: ['$avgDiscount', 1] },
        },
      },
    ]);

    res.json({ trend });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/top-discounted?limit=10
 * Top tài sản giảm sâu nhất
 */
router.get('/top-discounted', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const top = await Duplicate.aggregate([
      {
        $match: {
          isPriceDrop: true,
          type: 'auction',
          priceDropPercent: { $gt: 0 },
          $expr: { $lt: ['$latestPrice', '$firstPrice'] },
        },
      },
      { $sort: { priceDropPercent: -1 } },
      { $limit: limit },
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
    ]);

    res.json({ items: top });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/newly-reduced?limit=4
 * Tài sản mới giảm giá gần đây
 */
router.get('/newly-reduced', async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 4));

    const items = await Duplicate.aggregate([
      {
        $match: {
          isPriceDrop: true,
          type: 'auction',
          priceDropPercent: { $gt: 0 },
          $expr: { $lt: ['$latestPrice', '$firstPrice'] },
        },
      },
      // Lấy publishedAt từ entry cuối cùng
      {
        $addFields: {
          latestPublishedAt: { $arrayElemAt: [{ $slice: ['$entries.publishedAt', -1] }, 0] },
        },
      },
      { $sort: { latestPublishedAt: -1 } },
      { $limit: limit },
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
          publishedAt: '$latestNotice.publishedAt',
          status: '$latestNotice.status',
          initialPrice: '$latestNotice.initialPrice',
          currentPrice: '$latestNotice.currentPrice',
        },
      },
    ]);

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/top-relisted?limit=10
 * Tài sản đăng lại nhiều nhất
 */
router.get('/top-relisted', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const items = await Duplicate.aggregate([
      {
        $match: {
          type: 'auction',
          relistCount: { $gt: 1 },
        },
      },
      // Lấy publishedAt từ entry cuối cùng
      {
        $addFields: {
          latestPublishedAt: { $arrayElemAt: [{ $slice: ['$entries.publishedAt', -1] }, 0] },
        },
      },
      { $sort: { relistCount: -1, latestPublishedAt: -1 } },
      { $limit: limit },
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
          publishedAt: '$latestNotice.publishedAt',
          status: '$latestNotice.status',
          initialPrice: '$latestNotice.initialPrice',
          currentPrice: '$latestNotice.currentPrice',
        },
      },
    ]);

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
