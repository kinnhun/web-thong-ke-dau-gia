const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const ids = [285224, 286524, 287574, 402871, 404437, 424960, 426469];
    const notices = await AuctionNotice.find({ sourceId: { $in: ids } }).select('sourceId initialPrice currentPrice publishRound publishRoundLabel name publishedAt rootId relatedIds').lean();
    console.log('Auction Notices:');
    notices.forEach(n => {
      console.log(`- sourceId: ${n.sourceId}, initialPrice: ${n.initialPrice}, currentPrice: ${n.currentPrice}, publishRound: ${n.publishRound}, publishRoundLabel: ${n.publishRoundLabel}, publishedAt: ${n.publishedAt}, rootId: ${n.rootId}, relatedIds: ${JSON.stringify(n.relatedIds)}, name: ${n.name}`);
    });
    
    console.log('\nDuplicates containing any of these sourceIds:');
    const dups = await Duplicate.find({ sourceIds: { $in: ids } }).lean();
    dups.forEach(d => {
      console.log(`- Dup ID: ${d._id}, name: ${d.name}, relistCount: ${d.relistCount}, sourceIds: ${d.sourceIds}`);
      d.entries.forEach(e => {
        console.log(`  * entry: sourceId=${e.sourceId}, price=${e.price}, publishRound=${e.publishRound}, publishRoundLabel=${e.publishRoundLabel}, publishedAt=${e.publishedAt}`);
      });
    });
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
