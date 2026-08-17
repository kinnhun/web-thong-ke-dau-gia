const { Router } = require('express');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');

const router = Router();

const StatCache = require('../models/StatCache');

// ... (other cached definitions removed since we use DB cache)

/**
 * GET /api/dashboard/stats
 * KPI tổng hợp cho trang Dashboard
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stat = await StatCache.findOne({ key: 'dashboard-stats' }).lean();
    if (stat && stat.data) {
      return res.json(stat.data);
    }
    return res.json({
      totalAuctions: 0, totalOrg: 0, recentCount: 0, newIn72h: 0,
      totalDiscounted: 0, maxDiscountPercent: 0, maxDiscountItem: null, totalReducedValue: 0,
      byType: [], byProvince: [], byStatus: []
    });
  } catch (err) { next(err); }
});

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
    ]).allowDiskUse(true);

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
        },
      },
      { $sort: { priceDropPercent: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'auctionnotices',
          let: { sourceIds: '$sourceIds' },
          pipeline: [
            { $match: { $expr: { $in: ['$sourceId', '$$sourceIds'] } } },
            { $sort: { publishedAt: -1 } },
            { $limit: 1 }
          ],
          as: 'latestNoticeArray',
        },
      },
      {
        $addFields: {
          latestNotice: { $arrayElemAt: ['$latestNoticeArray', 0] },
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
          shortDescription: '$latestNotice.shortDescription',
          sourceId: '$latestNotice.sourceId',
          type: '$latestNotice.type',
          province: '$latestNotice.province',
          organizer: '$latestNotice.organizer',
          publishedAt: '$latestNotice.publishedAt',
          status: '$latestNotice.status',
          initialPrice: '$latestNotice.initialPrice',
          currentPrice: '$latestNotice.currentPrice',
          properties: '$latestNotice.properties',
        },
      },
    ]).allowDiskUse(true);

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
          let: { sourceIds: '$sourceIds' },
          pipeline: [
            { $match: { $expr: { $in: ['$sourceId', '$$sourceIds'] } } },
            { $sort: { publishedAt: -1 } },
            { $limit: 1 }
          ],
          as: 'latestNoticeArray',
        },
      },
      {
        $addFields: {
          latestNotice: { $arrayElemAt: ['$latestNoticeArray', 0] },
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
          shortDescription: '$latestNotice.shortDescription',
          sourceId: '$latestNotice.sourceId',
          type: '$latestNotice.type',
          province: '$latestNotice.province',
          publishedAt: '$latestNotice.publishedAt',
          status: '$latestNotice.status',
          initialPrice: '$latestNotice.initialPrice',
          currentPrice: '$latestNotice.currentPrice',
          properties: '$latestNotice.properties',
        },
      },
    ]).allowDiskUse(true);

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
          let: { sourceIds: '$sourceIds' },
          pipeline: [
            { $match: { $expr: { $in: ['$sourceId', '$$sourceIds'] } } },
            { $sort: { publishedAt: -1 } },
            { $limit: 1 }
          ],
          as: 'latestNoticeArray',
        },
      },
      {
        $addFields: {
          latestNotice: { $arrayElemAt: ['$latestNoticeArray', 0] },
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
          shortDescription: '$latestNotice.shortDescription',
          sourceId: '$latestNotice.sourceId',
          type: '$latestNotice.type',
          province: '$latestNotice.province',
          publishedAt: '$latestNotice.publishedAt',
          status: '$latestNotice.status',
          initialPrice: '$latestNotice.initialPrice',
          currentPrice: '$latestNotice.currentPrice',
          properties: '$latestNotice.properties',
        },
      },
    ]).allowDiskUse(true);

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
