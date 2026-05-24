const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  console.log('✅ Connected to MongoDB');

  const Duplicate = mongoose.model('Duplicate', new mongoose.Schema({}, { strict: false }));

  const targetIds = [566731, 241186, 268652, 466453, 566714];
  
  console.log('\n--- FINDING DUPLICATES CONTAINING TARGET IDS ---');
  for (const id of targetIds) {
    const dup = await Duplicate.findOne({ sourceIds: id }).lean();
    if (dup) {
      console.log(`\nID #${id} is in Duplicate Group:`);
      console.log(`  Group ID: ${dup._id}`);
      console.log(`  Name: "${dup.name}"`);
      console.log(`  Source IDs in Group: [${dup.sourceIds.join(', ')}]`);
      console.log(`  Relist Count: ${dup.relistCount}`);
      console.log(`  Is Price Drop: ${dup.isPriceDrop}`);
      console.log(`  Price Drop Percent: ${dup.priceDropPercent}%`);
    } else {
      console.log(`\nID #${id} is NOT in any duplicate group.`);
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
