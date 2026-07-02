const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const Duplicate = require('../src/models/Duplicate');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const dupId = '6a312c2ca9a681f61f0fff11';
  const dup = await Duplicate.findById(dupId).lean();
  if (!dup) {
    console.log(`Duplicate group ${dupId} not found.`);
    await mongoose.connection.close();
    return;
  }

  console.log(`=== DUPLICATE GROUP: ${dup.name} ===`);
  console.log(`Source IDs in group: ${dup.sourceIds.join(', ')}`);

  const groupNotices = await AuctionNotice.find({ sourceId: { $in: dup.sourceIds } })
    .select('sourceId name initialPrice properties')
    .lean();

  for (const n of groupNotices) {
    console.log(`\n- Notice ID: ${n.sourceId}`);
    console.log(`  Name: ${n.name}`);
    console.log(`  Properties:`, JSON.stringify(n.properties, null, 2));
  }

  await mongoose.connection.close();
}

run().catch(console.error);
