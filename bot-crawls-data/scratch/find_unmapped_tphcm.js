const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');
const AuctionNotice = require('../src/models/AuctionNotice');
const { scoreAssetPair } = require('../src/utils/helpers');

async function run() {
  await connectDB();

  console.log('Fetching all asset items for TP. Hồ Chí Minh...');
  const items = await AssetItem.find({ sourceType: 'auction', province: 'TP. Hồ Chí Minh' }).lean();
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

  console.log(`Grouped into ${plotMap.size} distinct plot numbers.`);

  let unmappedCount = 0;
  let printLimit = 15;

  for (const [plot, list] of plotMap.entries()) {
    if (list.length < 2) continue;

    // Load notices to see rootIds
    const sourceIds = list.map(item => item.sourceId);
    const notices = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).select('sourceId rootId name initialPrice').lean();
    const noticeMap = new Map(notices.map(n => [n.sourceId, n]));

    // Check if there are different rootIds or undefined rootIds
    const rootIds = new Set(notices.map(n => n.rootId?.toString()).filter(Boolean));
    const hasUndefinedRoot = notices.some(n => !n.rootId);

    if (rootIds.size > 1 || (rootIds.size === 1 && hasUndefinedRoot) || (rootIds.size === 0 && list.length >= 2)) {
      // Find pairs that should match but aren't grouped together
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const itemA = list[i];
          const itemB = list[j];

          const nA = noticeMap.get(itemA.sourceId);
          const nB = noticeMap.get(itemB.sourceId);
          if (!nA || !nB) continue;

          // If they already have the same rootId, skip
          if (nA.rootId && nB.rootId && nA.rootId.toString() === nB.rootId.toString()) continue;

          const res = scoreAssetPair(itemA, itemB);
          if (res.score >= 80 || res.decision === 'auto_group') {
            unmappedCount++;
            if (printLimit > 0) {
              console.log(`\n--- Unmapped Pair for plot: ${plot} ---`);
              console.log(`Item A: [${itemA.sourceId}] Price: ${nA.initialPrice} | RootId: ${nA.rootId || 'None'} | Name: ${nA.name}`);
              console.log(`Item B: [${itemB.sourceId}] Price: ${nB.initialPrice} | RootId: ${nB.rootId || 'None'} | Name: ${nB.name}`);
              console.log(`Identifiers A:`, itemA.identifiers);
              console.log(`Identifiers B:`, itemB.identifiers);
              console.log(`Score: ${res.score}, Decision: ${res.decision}`);
              console.log(`Reasons:`, res.reasons);
              console.log(`Conflicts:`, res.conflicts);
              printLimit--;
            }
          }
        }
      }
    }
  }

  console.log(`\nTotal unmapped pairs found: ${unmappedCount}`);
  await closeDB();
}

run().catch(console.error);
