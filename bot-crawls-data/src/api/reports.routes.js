const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const Duplicate = require('../models/Duplicate');

const router = Router();

/**
 * GET /api/reports/by-province?limit=10
 * Top tỉnh có nhiều tài sản giảm giá
 */
router.get('/by-province', async (req, res, next) => {
  try {
    const limit = Math.min(30, parseInt(req.query.limit) || 10);

    const data = await Duplicate.aggregate([
      { $match: { type: 'auction' } },
      {
        $lookup: {
          from: 'auctionnotices',
          localField: 'sourceIds',
          foreignField: 'sourceId',
          as: 'notices',
          pipeline: [
            { $sort: { publishedAt: -1 } },
            { $limit: 1 },
            { $project: { province: 1 } },
          ],
        },
      },
      { $addFields: { province: { $cond: [{ $or: [{ $eq: [{ $arrayElemAt: ['$notices.province', 0] }, null] }, { $eq: [{ $arrayElemAt: ['$notices.province', 0] }, ''] }] }, 'Chưa cập nhật', { $arrayElemAt: ['$notices.province', 0] }] } } },
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
    ]);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/by-type
 * Phân bố theo loại tài sản
 */
router.get('/by-type', async (req, res, next) => {
  try {
    const data = await AuctionNotice.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, type: '$_id', count: 1 } },
    ]);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/monthly-trend?months=8
 * Xu hướng theo tháng
 */
router.get('/monthly-trend', async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months) || 8));
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const data = await Duplicate.aggregate([
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
    ]);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/top-discount?by=percent|amount&limit=5
 * Top tài sản theo % giảm hoặc số tiền giảm
 */
router.get('/top-discount', async (req, res, next) => {
  try {
    const by = req.query.by === 'amount' ? 'amount' : 'percent';
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 5));

    const pipeline = [
      { $match: { isPriceDrop: true, type: 'auction' } },
      {
        $addFields: {
          reducedAmount: { $subtract: ['$firstPrice', '$latestPrice'] },
        },
      },
      { $sort: by === 'amount' ? { reducedAmount: -1 } : { priceDropPercent: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'auctionnotices',
          localField: 'sourceIds',
          foreignField: 'sourceId',
          as: 'notices',
          pipeline: [
            { $sort: { publishedAt: -1 } },
            { $limit: 1 },
            { $project: { province: 1, type: 1, sourceId: 1 } },
          ],
        },
      },
      {
        $project: {
          name: 1,
          firstPrice: 1,
          latestPrice: 1,
          priceDropPercent: 1,
          reducedAmount: 1,
          relistCount: 1,
          province: { $arrayElemAt: ['$notices.province', 0] },
          type: { $arrayElemAt: ['$notices.type', 0] },
          sourceId: { $arrayElemAt: ['$notices.sourceId', 0] },
        },
      },
    ];

    const data = await Duplicate.aggregate(pipeline);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
