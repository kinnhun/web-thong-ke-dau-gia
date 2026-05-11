const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
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
