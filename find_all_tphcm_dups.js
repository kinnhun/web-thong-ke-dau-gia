const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const dups = await Duplicate.find({ organizer: /THÀNH TRÍ|THỊNH TRÍ/i }).lean();
    console.log(`Found ${dups.length} duplicate groups for THÀNH TRÍ:`);
    dups.forEach(d => {
      console.log(`- Dup ID: ${d._id}, relistCount: ${d.relistCount}, sourceIds: ${d.sourceIds}`);
      console.log(`  canonicalTitle: ${d.canonicalTitle}`);
      console.log(`  entries count: ${d.entries.length}`);
      d.entries.forEach(e => {
        console.log(`    * entry: sourceId=${e.sourceId}, price=${e.price}, publishRound=${e.publishRound}, publishRoundLabel=${e.publishRoundLabel}, publishedAt=${e.publishedAt}`);
      });
    });
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
