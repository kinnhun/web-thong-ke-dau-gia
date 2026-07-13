const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    // Let's find notices with price 49221500000
    const noticesWithHighPrice = await AuctionNotice.find({ price: 49221500000 }).lean();
    console.log('Notices with 49,221,500,000:', noticesWithHighPrice);

    // Let's find all duplicate documents containing notices with title similar to 'Trang thiết bị, vật tư'
    const dups = await Duplicate.find({ name: /Trang thiết bị, vật tư/i }).lean();
    console.log('Dups matching title:', dups.map(d => ({
      _id: d._id,
      name: d.name,
      relistCount: d.relistCount,
      sourceIds: d.sourceIds,
      entries: d.entries.map(e => ({
        sourceId: e.sourceId,
        price: e.price,
        publishedAt: e.publishedAt,
        publishRound: e.publishRound,
        publishRoundLabel: e.publishRoundLabel
      }))
    })));
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
