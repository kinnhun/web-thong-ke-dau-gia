const mongoose = require('mongoose');
const AuctionNotice = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  try {
    const a = await AuctionNotice.findOne({ sourceId: 383858 }).select('rootId duplicateId').lean();
    console.log('383858:', a);
    const b = await AuctionNotice.findOne({ sourceId: 562920 }).select('rootId duplicateId').lean();
    console.log('562920:', b);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
