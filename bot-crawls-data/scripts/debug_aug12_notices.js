const mongoose = require('mongoose');
const config = require('../src/config');
const AuctionNotice = require('../src/models/AuctionNotice');

async function debugAug12() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected DB');

  // Lấy 20 bài có sourceId lớn nhất vừa cào
  const topItems = await AuctionNotice.find({ sourceId: { $gt: 640000 } }).sort({ sourceId: -1 }).limit(20).lean();

  console.log(`🔍 Tìm thấy ${topItems.length} bài đăng có sourceId > 640000:`);
  topItems.forEach(item => {
    console.log({
      sourceId: item.sourceId,
      name: item.name.substring(0, 50),
      publishedAt: item.publishedAt,
      publishTime1: item.publishTime1,
      publishTime2: item.publishTime2,
      publishTime: item.publishTime,
      createdDate: item.createdDate,
      aucTime: item.aucTime,
      aucRegTimeStart: item.aucRegTimeStart
    });
  });

  await mongoose.disconnect();
}

debugAug12().catch(console.error);
