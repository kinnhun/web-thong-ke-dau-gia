const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const doc = await AuctionNotice.findById('69f1fbbc32655d62da81beff').lean();
    console.log('Doc 69f1fbbc32655d62da81beff:', doc);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
