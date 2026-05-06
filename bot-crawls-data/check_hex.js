const mongoose = require('mongoose');
const AuctionNotice = require('./src/models/AuctionNotice');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  const ids = [485709, 484804, 446524];
  const items = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();
  items.forEach(i => {
    console.log(`ID ${i.sourceId}: [${i.name}]`);
    console.log(`Hex: ${Buffer.from(i.name).toString('hex')}`);
    const clean = i.name.toLowerCase().replace(/[,\.\(\):\-]/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`Clean: [${clean}]`);
    console.log(`Clean Hex: ${Buffer.from(clean).toString('hex')}`);
    console.log('---');
  });
  process.exit(0);
}

check();
