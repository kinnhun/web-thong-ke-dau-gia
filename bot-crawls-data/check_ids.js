const mongoose = require('mongoose');
const AuctionNotice = require('./src/models/AuctionNotice');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  const ids = [564520, 484804, 485709, 446524];
  const items = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();
  console.log(JSON.stringify(items.map(i => ({
    sourceId: i.sourceId,
    name: i.name,
    province: i.province,
    organizer: i.organizer,
    relatedIds: i.relatedIds
  })), null, 2));
  process.exit(0);
}

check();
