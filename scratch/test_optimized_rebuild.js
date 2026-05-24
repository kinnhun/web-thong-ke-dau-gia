const mongoose = require('mongoose');
const { rebuildAllDuplicateEntries } = require('../bot-crawls-data/src/scrapers/detail.scraper');
const Duplicate = require('../bot-crawls-data/src/models/Duplicate');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  console.log('✅ Connected to MongoDB');

  const countBefore = await Duplicate.countDocuments();
  console.log(`Current total duplicate groups in DB: ${countBefore}`);

  console.log('\n--- Starting optimized rebuildAllDuplicateEntries ---');
  const start = Date.now();
  
  const updatedCount = await rebuildAllDuplicateEntries(
    () => false,
    (msg) => console.log(`   [Progress] ${msg}`)
  );
  
  const duration = Date.now() - start;
  console.log(`--- Finished! ---`);
  console.log(`Rebuilt groups: ${updatedCount}`);
  console.log(`Execution time: ${duration} ms`);

  // Print details of the rebuilt groups to ensure data integrity
  const groups = await Duplicate.find({}).lean();
  for (const group of groups) {
    console.log(`\nGroup ID: ${group._id}`);
    console.log(`  Name: "${group.name}"`);
    console.log(`  Source IDs: [${group.sourceIds.join(', ')}]`);
    console.log(`  Relist Count: ${group.relistCount}`);
    console.log(`  First Price: ${group.firstPrice}`);
    console.log(`  LatestPrice: ${group.latestPrice}`);
    console.log(`  Is Price Drop: ${group.isPriceDrop} (${group.priceDropPercent}%)`);
    console.log(`  Root ID: ${group.rootId}`);
    console.log(`  Province: ${group.province}`);
  }

  await mongoose.disconnect();
}

test().catch(console.error);
