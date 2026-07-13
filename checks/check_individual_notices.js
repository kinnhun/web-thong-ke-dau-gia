const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  console.log('--- Inspecting Notices in 6a313420a9a681f61f13abdc ---');
  const sourceIds = [17827, 17831, 18141, 18149, 47078, 62725];
  const items = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).lean();

  items.forEach(item => {
    console.log(`\nSourceID: ${item.sourceId}`);
    console.log(`  Name: "${item.name}"`);
    console.log(`  Organizer: "${item.organizer}"`);
    console.log(`  Initial Price: ${item.initialPrice}`);
    console.log(`  RootID: ${item.rootId}`);
    console.log(`  RelatedIDs: ${JSON.stringify(item.relatedIds)}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
