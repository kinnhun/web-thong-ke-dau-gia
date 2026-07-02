const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const { scoreAssetPair } = require('../src/utils/helpers');

async function run() {
  await connectDB();

  const sourceIds = [239759, 241186, 566731];
  console.log('--- Inspecting AuctionNotices ---');
  const notices = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).lean();
  notices.forEach(n => {
    console.log(`SourceID: ${n.sourceId}`);
    console.log(`Title: ${n.titleName}`);
    console.log(`Name: ${n.name}`);
    console.log(`Province: ${n.province}, District: ${n.district}`);
    console.log(`Initial Price: ${n.initialPrice}`);
    console.log(`Properties:`, JSON.stringify(n.properties, null, 2));
    console.log('--------------------------------');
  });

  console.log('--- Inspecting AssetItems ---');
  const items = await AssetItem.find({ sourceId: { $in: sourceIds } }).lean();
  items.forEach(item => {
    console.log(`AssetItem sourceId: ${item.sourceId}, index: ${item.itemIndex}`);
    console.log(`Name: ${item.name}`);
    console.log(`Province: ${item.province}, District: ${item.district}, Ward: ${item.ward}`);
    console.log(`Identifiers:`, item.identifiers);
    console.log(`Blocking Keys:`, item.blockingKeys);
    console.log('--------------------------------');
  });

  if (items.length > 1) {
    console.log('--- Pairwise scoring ---');
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const itemA = items[i];
        const itemB = items[j];
        const res = scoreAssetPair(itemA, itemB);
        console.log(`Pair: ${itemA.sourceId} index ${itemA.itemIndex} & ${itemB.sourceId} index ${itemB.itemIndex}`);
        console.log(`Score: ${res.score}, Decision: ${res.decision}`);
        console.log(`Reasons:`, res.reasons);
        console.log(`Conflicts:`, res.conflicts);
        console.log('--------------------------------');
      }
    }
  }

  await closeDB();
}

run().catch(console.error);
