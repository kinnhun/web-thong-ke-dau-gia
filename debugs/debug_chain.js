const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  console.log('Finding Duplicate record for 570261...');
  const dup1 = await Duplicate.findOne({ sourceIds: 570261 });
  if (dup1) {
    console.log('Found Duplicate containing 570261:', dup1._id);
    console.log('Name:', dup1.name);
    console.log('Source IDs count:', dup1.sourceIds.length);
    console.log('Source IDs:', dup1.sourceIds);
  } else {
    console.log('No Duplicate containing 570261.');
  }

  console.log('\nFinding Duplicate record for 121662...');
  const dup2 = await Duplicate.findOne({ sourceIds: 121662 });
  if (dup2) {
    console.log('Found Duplicate containing 121662:', dup2._id);
    console.log('Name:', dup2.name);
    console.log('Source IDs count:', dup2.sourceIds.length);
    console.log('Source IDs:', dup2.sourceIds);
  } else {
    console.log('No Duplicate containing 121662.');
  }

  if (dup1 && dup2 && dup1._id.toString() === dup2._id.toString()) {
    console.log('\nBoth belong to the SAME Duplicate document!');
    
    // Let's fetch details of all auction notices in this duplicate record
    const notices = await AuctionNotice.find({ sourceId: { $in: dup1.sourceIds } })
      .select('sourceId name rootId relatedIds province initialPrice')
      .lean();
      
    console.log('\nAll Auction Notices in this group:');
    for (const notice of notices) {
      console.log(`- #${notice.sourceId}: Name: "${notice.name.slice(0, 100)}..."`);
      console.log(`  rootId: ${notice.rootId}, relatedIds: ${JSON.stringify(notice.relatedIds)}`);
    }
  }

  await mongoose.connection.close();
}

run().catch(console.error);
