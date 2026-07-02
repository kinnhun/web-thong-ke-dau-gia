const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');
const { scoreAssetPair } = require('../src/utils/helpers');

async function run() {
  await connectDB();

  console.log('Fetching HCMC Center asset items...');
  const items = await AssetItem.find({
    sourceType: 'auction',
    auctionOrg: 'Trung tâm Dịch vụ bán đấu giá tài sản TPHCM'
  }).lean();
  console.log(`Fetched ${items.length} items.`);

  // Group by plotNumber
  const plotMap = new Map();
  items.forEach(item => {
    const plot = item.identifiers?.plotNumber;
    if (plot && plot.trim().length > 0 && plot !== '0' && plot.length < 10) {
      if (!plotMap.has(plot)) plotMap.set(plot, []);
      plotMap.get(plot).push(item);
    }
  });

  console.log('Searching for same-plot same-district pairs in this organizer that failed to auto-group...');
  let failedCount = 0;
  let printLimit = 20;

  for (const [plot, list] of plotMap.entries()) {
    if (list.length < 2) continue;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const itemA = list[i];
        const itemB = list[j];

        const sameDistrict = itemA.district && itemB.district && itemA.district === itemB.district;
        const sameWard = itemA.ward && itemB.ward && itemA.ward === itemB.ward;
        if (!sameDistrict && !sameWard) continue;

        const res = scoreAssetPair(itemA, itemB);
        if (res.decision !== 'auto_group') {
          failedCount++;
          if (printLimit > 0) {
            console.log(`\n--- FAILED MATCH pair for plot: ${plot} ---`);
            console.log(`Item A [${itemA.sourceId}]: ${itemA.name}`);
            console.log(`Item B [${itemB.sourceId}]: ${itemB.name}`);
            console.log(`Identifiers A:`, itemA.identifiers);
            console.log(`Identifiers B:`, itemB.identifiers);
            console.log(`District A: ${itemA.district}, Ward A: ${itemA.ward}`);
            console.log(`District B: ${itemB.district}, Ward B: ${itemB.ward}`);
            console.log(`Score: ${res.score}, Decision: ${res.decision}`);
            console.log(`Reasons:`, res.reasons);
            console.log(`Conflicts:`, res.conflicts);
            printLimit--;
          }
        }
      }
    }
  }

  console.log(`\nTotal same-plot same-district/ward pairs that failed to auto-group: ${failedCount}`);
  await closeDB();
}

run().catch(console.error);
