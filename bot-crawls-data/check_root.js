const mongoose = require('mongoose');
const AuctionNotice = require('./src/models/AuctionNotice');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  const items = await AuctionNotice.find({ sourceId: { $in: [564520, 446524, 484804] } }).lean();
  console.log("Found:", items.length);
  items.forEach(i => console.log(`ID: ${i.sourceId}, rootId: ${i.rootId}, publishRound: ${i.publishRound}`));
  process.exit(0);
}

check();
