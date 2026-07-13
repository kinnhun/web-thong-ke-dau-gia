const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const rootId = 532066;
  const notices = await AuctionNotice.find({ rootId: rootId }).lean();

  console.log(`Found ${notices.length} notices in rootId ${rootId}:`);
  for (const n of notices) {
    console.log(`- ID: ${n.sourceId}`);
    console.log(`  Name: "${n.name}"`);
    console.log(`  province: "${n.province}"`);
    console.log(`  relatedIds: ${JSON.stringify(n.relatedIds)}`);
    console.log(`  organizer: "${n.organizer}"`);
  }

  await mongoose.connection.close();
}

run().catch(console.error);
