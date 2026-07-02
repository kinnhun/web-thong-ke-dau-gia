const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');
const { scoreAssetPair } = require('../src/utils/helpers');

async function run() {
  await connectDB();

  console.log('Querying AssetItem with plotNumber 137 or name containing "thửa đất số 137"...');
  const items = await AssetItem.find({
    $or: [
      { name: /thửa đất số 137/i },
      { 'identifiers.plotNumber': '137' }
    ]
  }).lean();

  console.log(`Found ${items.length} total items in AssetItem.`);

  // Group by province
  const groups = {};
  items.forEach(item => {
    const prov = item.province || 'Unknown';
    if (!groups[prov]) groups[prov] = [];
    groups[prov].push(item);
  });

  console.log('\nGrouped by Province:');
  for (const prov in groups) {
    console.log(`- ${prov}: ${groups[prov].length} items`);
  }

  // Choose a province with many items, e.g. TP. Hồ Chí Minh or Long An or Sóc Trăng
  const provincesToCheck = ['TP. Hồ Chí Minh', 'Long An', 'Sóc Trăng'].filter(p => groups[p]);
  
  for (const prov of provincesToCheck) {
    console.log(`\n========================================`);
    console.log(`Testing scoring for Province: ${prov} (${groups[prov].length} items)`);
    console.log(`========================================`);
    const provItems = groups[prov];

    // Take the first 5 items to show details and pair scores
    console.log('Sample Items:');
    provItems.slice(0, 5).forEach((item, idx) => {
      console.log(`Item ${idx} (sourceId: ${item.sourceId}):`);
      console.log(`  Name: "${item.name.substring(0, 150)}..."`);
      console.log(`  Ward: "${item.ward}", District: "${item.district}"`);
      console.log(`  Plot: "${item.identifiers?.plotNumber}", Map: "${item.identifiers?.mapSheet}", Area: ${item.area}`);
      console.log(`  Owner: "${item.ownerName}"`);
      console.log(`  Blocking Keys:`, item.blockingKeys);
    });

    // Score all pairs among sample items
    console.log('\nPairwise Scoring Results:');
    let pairCount = 0;
    for (let i = 0; i < Math.min(provItems.length, 5); i++) {
      for (let j = i + 1; j < Math.min(provItems.length, 5); j++) {
        const itemA = provItems[i];
        const itemB = provItems[j];
        const result = scoreAssetPair(itemA, itemB);
        pairCount++;
        console.log(`- Pair: ${itemA.sourceId} & ${itemB.sourceId}`);
        console.log(`  Score: ${result.score}, Decision: ${result.decision}`);
        console.log(`  Reasons:`, result.reasons);
        console.log(`  Conflicts:`, result.conflicts);
      }
    }
  }

  await closeDB();
}

run().catch(console.error);
