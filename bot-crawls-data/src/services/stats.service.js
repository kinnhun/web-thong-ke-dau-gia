const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');
const StatCache = require('../models/StatCache');

async function refreshStats() {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Compute stats sequentially to avoid MongoDB OOM/CPU spikes on VPS
    const totalAuctions = await AuctionNotice.countDocuments();
    const totalOrg = await OrgSelection.countDocuments();
    const recentCount = await AuctionNotice.countDocuments({ publishedAt: { $gte: sevenDaysAgo } });
    const newIn72h = await AuctionNotice.countDocuments({ publishedAt: { $gte: threeDaysAgo } });
    const byType = await AuctionNotice.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
    const byProvince = await AuctionNotice.aggregate([
      { $match: { province: { $ne: '' } } },
      { $group: { _id: '$province', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    const byStatus = await AuctionNotice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const totalAuctionDuplicates = await Duplicate.countDocuments({ type: 'auction' });
    const totalOrgDuplicates = await Duplicate.countDocuments({ type: 'org' });
    const priceDropCount = await Duplicate.countDocuments({ isPriceDrop: true });
    const pendingAuctionDetail = await AuctionNotice.countDocuments({ detailScraped: { $ne: true } });
    const pendingOrgDetail = await OrgSelection.countDocuments({ detailScraped: { $ne: true } });
    
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

    // Save to Cache Table
    await StatCache.findOneAndUpdate(
      { key: 'dashboard-stats' },
      { data: dashboardStats, lastUpdated: new Date() },
      { upsert: true, new: true }
    );

    await StatCache.findOneAndUpdate(
      { key: 'auctions-stats' },
      { data: auctionsStats, lastUpdated: new Date() },
      { upsert: true, new: true }
    );

    console.log(`[${new Date().toISOString()}] Stats refreshed into StatCache collection.`);
  } catch (err) {
    console.error('Error refreshing stats:', err.message);
  }
}

module.exports = { refreshStats };
