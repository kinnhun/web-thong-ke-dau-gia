const mongoose = require('mongoose');
const Duplicate = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  try {
    const dup = await Duplicate.findOne({ sourceIds: 562920 }).lean();
    console.log('Duplicate Doc for 562920:', dup);
    
    if (dup) {
      console.log('There are', dup.sourceIds.length, 'sourceIds in this duplicate group.');
    } else {
      console.log('NOT FOUND in Duplicate collection!');
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
