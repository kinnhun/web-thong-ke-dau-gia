const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const Duplicate = require('../models/Duplicate');

const router = Router();

// In-memory cache for reports
const reportCache = {
  byProvince: { data: null, timestamp: 0 },
  byType: { data: null, timestamp: 0 },
  monthlyTrend: { data: null, timestamp: 0 },
  topDiscountPercent: { data: null, timestamp: 0 },
  topDiscountAmount: { data: null, timestamp: 0 },
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Helper to wrap route handlers with caching
 */
const withCache = (cacheKey, fetchFn) => async (req, res, next) => {
  try {
    const now = Date.now();
    const cacheEntry = reportCache[cacheKey];
    
    // Return cached data if valid
    if (cacheEntry.data && (now - cacheEntry.timestamp < CACHE_TTL)) {
      return res.json({ data: cacheEntry.data });
    }

    // Otherwise fetch fresh data
    const data = await fetchFn(req);
    
    // Update cache
    reportCache[cacheKey] = {
      data,
      timestamp: Date.now()
    };
    
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/by-province?limit=10
 * Top tỉnh có nhiều tài sản giảm giá
 */
router.get('/by-province', withCache('byProvince', async (req) => {
  const limit = Math.min(30, parseInt(req.query.limit) || 10);

  return await Duplicate.aggregate([
    { $match: { type: 'auction', province: { $exists: true, $ne: null, $ne: '' } } },
    {
      $group: {
        _id: '$province',
        count: { $sum: 1 },
        avgDiscount: { $avg: '$priceDropPercent' },
        maxDiscount: { $max: '$priceDropPercent' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        province: '$_id',
        count: 1,
        avg: { $round: ['$avgDiscount', 1] },
        max: { $round: ['$maxDiscount', 1] },
      },
    },
  ]).allowDiskUse(true);
}));

/**
 * GET /api/reports/by-type
 * Phân bố theo loại tài sản
 */
router.get('/by-type', withCache('byType', async () => {
  return await AuctionNotice.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, type: '$_id', count: 1 } },
  ]).allowDiskUse(true);
}));

/**
 * GET /api/reports/monthly-trend?months=8
 * Xu hướng theo tháng
 */
router.get('/monthly-trend', withCache('monthlyTrend', async (req) => {
  const months = Math.min(24, Math.max(1, parseInt(req.query.months) || 8));
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  return await Duplicate.aggregate([
    { $match: { type: 'auction', updatedAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } },
        count: { $sum: 1 },
        avg: { $avg: '$priceDropPercent' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        month: '$_id',
        count: 1,
        avg: { $round: ['$avg', 1] },
      },
    },
  ]).allowDiskUse(true);
}));

/**
 * GET /api/reports/top-discount?by=percent|amount&limit=5
 * Top tài sản theo % giảm hoặc số tiền giảm
 */
router.get('/top-discount', async (req, res, next) => {
  try {
    const by = req.query.by === 'amount' ? 'amount' : 'percent';
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 5));
    const cacheKey = by === 'amount' ? 'topDiscountAmount' : 'topDiscountPercent';
    
    const now = Date.now();
    const cacheEntry = reportCache[cacheKey];
    
    if (cacheEntry.data && (now - cacheEntry.timestamp < CACHE_TTL)) {
      return res.json({ data: cacheEntry.data.slice(0, limit) });
    }

    const pipeline = [
      { $match: { isPriceDrop: true, type: 'auction' } },
      {
        $addFields: {
          reducedAmount: { $subtract: ['$firstPrice', '$latestPrice'] },
        },
      },
      { $sort: by === 'amount' ? { reducedAmount: -1 } : { priceDropPercent: -1 } },
      { $limit: 20 }, // Cache up to 20
      {
        $project: {
          name: 1,
          firstPrice: 1,
          latestPrice: 1,
          priceDropPercent: 1,
          reducedAmount: 1,
          relistCount: 1,
          province: 1,
          type: 1,
          sourceId: { $arrayElemAt: ['$sourceIds', 0] },
        },
      },
    ];

    const data = await Duplicate.aggregate(pipeline).allowDiskUse(true);
    
    reportCache[cacheKey] = {
      data,
      timestamp: Date.now()
    };
    
    res.json({ data: data.slice(0, limit) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
