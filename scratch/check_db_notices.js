const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  console.log('✅ Connected to MongoDB');

  const AuctionNotice = mongoose.model('AuctionNotice', new mongoose.Schema({}, { strict: false }));

  const targetIds = [566731, 241186, 268652, 466453, 566714];
  
  console.log('\n--- CHECKING AUCTION NOTICES ---');
  for (const id of targetIds) {
    const item = await AuctionNotice.findOne({ sourceId: id }).lean();
    if (item) {
      console.log(`ID #${id} FOUND: "${item.name}"`);
    } else {
      console.log(`ID #${id} NOT FOUND`);
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
