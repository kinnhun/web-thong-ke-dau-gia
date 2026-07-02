const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  console.log('--- 570261 Notice ---');
  const notice1 = await AuctionNotice.findOne({ sourceId: 570261 }).lean();
  console.log(JSON.stringify(notice1, null, 2));

  console.log('\n--- 121662 Notice ---');
  const notice2 = await AuctionNotice.findOne({ sourceId: 121662 }).lean();
  console.log(JSON.stringify(notice2, null, 2));

  await mongoose.connection.close();
}

run().catch(console.error);
