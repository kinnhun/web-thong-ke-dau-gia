const mongoose = require('mongoose');
const config = require('../src/config');
const AuctionNotice = require('../src/models/AuctionNotice');

async function checkAug12() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected DB');

  // Kiểm tra dải ngày 12/08/2026 theo UTC và theo Local Vietnam (+7)
  const startLocal = new Date('2026-08-12T00:00:00+07:00');
  const endLocal = new Date('2026-08-12T23:59:59.999+07:00');

  const countLocal = await AuctionNotice.countDocuments({
    publishedAt: { $gte: startLocal, $lte: endLocal }
  });

  console.log(`📅 Số lượng bài đăng ngày 12/08/2026 trong DB của chúng ta: ${countLocal}`);

  // Thử xem tổng số bài có ngày xuất bản trong khoảng 11/8 -> 13/8
  const countRange = await AuctionNotice.countDocuments({
    publishedAt: {
      $gte: new Date('2026-08-11T00:00:00+07:00'),
      $lte: new Date('2026-08-13T23:59:59+07:00')
    }
  });
  console.log(`📅 Số lượng bài từ 11/08 -> 13/08 trong DB: ${countRange}`);

  await mongoose.disconnect();
}

checkAug12().catch(console.error);
