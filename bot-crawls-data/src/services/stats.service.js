const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');
const StatCache = require('../models/StatCache');

// Throttle: không cho refresh stats quá thường xuyên
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 60 * 1000; // 1 phút tối thiểu giữa 2 lần

/**
 * Refresh stats vào StatCache.
 * Tối ưu:
 *  - Dùng estimatedDocumentCount cho total (O(1) thay vì O(N))
 *  - Chạy các aggregate tuần tự (tránh overload MongoDB trên VPS)
 *  - Throttle 1 phút giữa mỗi lần refresh
 */
async function refreshStats() {
  const now = Date.now();
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    return; // Skip - vừa refresh xong
  }
  lastRefreshTime = now;

  try {
    const nowDate = new Date();

    // Automatically sync/update statuses based on current time
    const completedRes = await AuctionNotice.updateMany(
      {
        auctionDate: { $lt: nowDate },
        status: { $ne: 'completed' }
      },
      {
        $set: { status: 'completed' }
      }
    );
    const receivingRes = await AuctionNotice.updateMany(
      {
        registrationEnd: { $gt: nowDate },
        status: { $ne: 'receiving_docs' }
      },
      {
        $set: { status: 'receiving_docs' }
      }
    );
    const upcomingRes = await AuctionNotice.updateMany(
      {
        auctionDate: { $gt: nowDate },
        $or: [
          { registrationEnd: { $lte: nowDate } },
          { registrationEnd: null }
        ],
        status: { $ne: 'upcoming' }
      },
      {
        $set: { status: 'upcoming' }
      }
    );
    if (completedRes.modifiedCount > 0 || receivingRes.modifiedCount > 0 || upcomingRes.modifiedCount > 0) {
      console.log(`[STATUS-SYNC] Updated statuses: completed (+${completedRes.modifiedCount}), receiving_docs (+${receivingRes.modifiedCount}), upcoming (+${upcomingRes.modifiedCount})`);
    }

    const threeDaysAgo = new Date(nowDate - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(nowDate - 7 * 24 * 60 * 60 * 1000);

    // ★ Dùng estimatedDocumentCount cho total (O(1), không lock collection)
    const totalAuctions = await AuctionNotice.estimatedDocumentCount();
    const totalOrg = await OrgSelection.estimatedDocumentCount();

    // Các count có filter vẫn cần countDocuments, nhưng chạy tuần tự
    const recentCount = await AuctionNotice.countDocuments({ publishedAt: { $gte: sevenDaysAgo } });
    const newIn72h = await AuctionNotice.countDocuments({ publishedAt: { $gte: threeDaysAgo } });
    
    // Aggregate nhẹ - giới hạn pipeline
    const byType = await AuctionNotice.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).option({ allowDiskUse: false });

    const byProvince = await AuctionNotice.aggregate([
      { $match: { province: { $ne: '' } } },
      { $group: { _id: '$province', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]).option({ allowDiskUse: false });

    const byStatus = await AuctionNotice.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).option({ allowDiskUse: false });

    // Duplicate counts - nhẹ vì collection nhỏ hơn nhiều
    const [totalAuctionDuplicates, totalOrgDuplicates, priceDropCount] = await Promise.all([
      Duplicate.countDocuments({ type: 'auction' }),
      Duplicate.countDocuments({ type: 'org' }),
      Duplicate.countDocuments({ isPriceDrop: true }),
    ]);

    const pendingAuctionDetail = await AuctionNotice.countDocuments({ detailScraped: { $ne: true } });
    const pendingOrgDetail = await OrgSelection.countDocuments({ detailScraped: { $ne: true } });
    
    // Discount stats - 1 aggregate trên Duplicate (collection nhỏ)
    const discountStats = await Duplicate.aggregate([
      {
        $match: {
          isPriceDrop: true,
          type: 'auction',
          priceDropPercent: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          maxPct: { $max: '$priceDropPercent' },
          totalReduced: { $sum: { $subtract: ['$firstPrice', '$latestPrice'] } },
        },
      },
    ]);
    
    const maxDiscountDocs = await Duplicate.aggregate([
      {
        $match: {
          isPriceDrop: true,
          type: 'auction',
          priceDropPercent: { $gt: 0 },
        },
      },
      { $sort: { priceDropPercent: -1 } },
      { $limit: 1 },
      { $project: { name: 1, priceDropPercent: 1, sourceIds: 1 } },
    ]);
    const maxDiscountDoc = maxDiscountDocs[0] || null;

    const ds = discountStats[0] || { count: 0, maxPct: 0, totalReduced: 0 };

    const dashboardStats = {
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

    const auctionsStats = {
      total: totalAuctions,
      recentCount,
      totalOrg,
      totalAuctionDuplicates,
      totalOrgDuplicates,
      priceDropCount,
      pendingAuctionDetail,
      pendingOrgDetail,
      byType: byType.map(t => ({ type: t._id, count: t.count })),
      byProvince: byProvince.map(p => ({ province: p._id, count: p.count })),
      byStatus: byStatus.map(s => ({ status: s._id, count: s.count })),
    };

    // Save to Cache Table (bulkWrite thay vì 2 findOneAndUpdate riêng)
    await StatCache.bulkWrite([
      {
        updateOne: {
          filter: { key: 'dashboard-stats' },
          update: { $set: { data: dashboardStats, lastUpdated: new Date() } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { key: 'auctions-stats' },
          update: { $set: { data: auctionsStats, lastUpdated: new Date() } },
          upsert: true,
        },
      },
    ]);

    console.log(`[${new Date().toISOString()}] Stats refreshed (${totalAuctions} auctions, ${totalOrg} org)`);
  } catch (err) {
    console.error('Error refreshing stats:', err.message);
  }
}

module.exports = { refreshStats };
