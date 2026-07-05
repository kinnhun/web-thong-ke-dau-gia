const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    // 1. Search notices containing "Bách Khoa"
    const bachKhoaNotices = await AuctionNotice.find({ name: /Bách Khoa/i }).select('sourceId initialPrice currentPrice publishRound publishRoundLabel name publishedAt').lean();
    console.log('Bach Khoa Notices found:', bachKhoaNotices.length);
    bachKhoaNotices.forEach(n => {
      console.log(`- sourceId: ${n.sourceId}, name: "${n.name}", initialPrice: ${n.initialPrice}, currentPrice: ${n.currentPrice}, publishRound: ${n.publishRound}, publishedAt: ${n.publishedAt}`);
    });

    // 2. Search notices with price 49221500000 or close to it
    const priceNotices = await AuctionNotice.find({ initialPrice: { $gte: 49000000000, $lte: 50000000000 } }).select('sourceId name initialPrice publishedAt').lean();
    console.log('\nPrice Notices (~49B):', priceNotices);

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
