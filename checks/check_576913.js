const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const notice = await AuctionNotice.findOne({ sourceId: 576913 }).lean();
    console.log(`Notice 576913 name: "${notice.name}"`);
    console.log(`Notice 576913 price: ${notice.initialPrice}`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
