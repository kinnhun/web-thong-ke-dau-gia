const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  console.log('--- Inspecting Suspicious High Price Drops (>80%) ---');
  const dups = await Duplicate.find({
    type: 'auction',
    isPriceDrop: true,
    priceDropPercent: { $gt: 80 }
  }).limit(30).lean();

  console.log(`Found ${dups.length} groups with drop > 80%.`);
  dups.forEach((d, idx) => {
    console.log(`\n[${idx+1}] Group ID: ${d._id}`);
    console.log(`  Name: "${d.name}"`);
    console.log(`  Organizer: "${d.organizer}"`);
    console.log(`  First Price: ${d.firstPrice}, Latest Price: ${d.latestPrice}, Drop %: ${d.priceDropPercent}`);
    console.log(`  Entries count: ${d.entries.length}`);
    d.entries.forEach(e => {
      console.log(`    - ID: ${e.sourceId}, Price: ${e.price}`);
    });
  });

  await mongoose.disconnect();
}

run().catch(console.error);
