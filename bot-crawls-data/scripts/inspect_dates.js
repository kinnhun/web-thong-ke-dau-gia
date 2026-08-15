const mongoose = require('mongoose');
const config = require('../src/config');
const AuctionNotice = require('../src/models/AuctionNotice');

async function inspectDates() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected DB');

  // Lấy 20 bài gần nhất theo createdAt hoặc sourceId
  const recentNotices = await AuctionNotice.find().sort({ sourceId: -1 }).limit(20).lean();

  console.log('🔍 20 bài đăng mới nhất trong DB:');
  recentNotices.forEach(n => {
    console.log(`- ID: ${n.sourceId} | Name: ${n.name.substring(0, 40)}... | publishedAt: ${n.publishedAt} | publishTime1: ${n.publishTime1} | publishTime2: ${n.publishTime2}`);
  });

  // Tìm min/max date của publishedAt trong DB
  const minMax = await AuctionNotice.aggregate([
    {
      $group: {
        _id: null,
        minDate: { $min: '$publishedAt' },
        maxDate: { $max: '$publishedAt' }
      }
    }
  ]);

  console.log('\n📊 Mốc ngày publishedAt nhỏ nhất và lớn nhất trong DB:', minMax);

  await mongoose.disconnect();
}

inspectDates().catch(console.error);
