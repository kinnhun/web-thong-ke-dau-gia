const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const { extractPropertyIdentifiers, scoreAssetPair, generateBlockingKeys } = require('../src/utils/helpers');

function mapAssetType(propertyTypeName = '', propertyName = '') {
  const combined = `${propertyTypeName} ${propertyName}`.toLowerCase();
  if (combined.includes('quyền sử dụng đất') || combined.includes('đất đai')) return 'land';
  if (combined.includes('nhà ở') || combined.includes('căn hộ') || combined.includes('chung cư')) return 'house';
  if (combined.includes('phương tiện') || combined.includes('ô tô') || combined.includes('xe')) return 'car';
  if (combined.includes('máy móc') || combined.includes('thiết bị') || combined.includes('dây chuyền')) return 'machinery';
  if (combined.includes('thi hành án')) return 'enforcement';
  return 'other';
}

async function run() {
  await connectDB();

  const sourceIds = [471403, 454852, 561763];
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

  // Calculate live values as well to see if current code handles it differently
  console.log('--- Live Extraction and Pairwise Scoring ---');
  const liveItems = notices.map(n => {
    const ids = extractPropertyIdentifiers(n.name);
    const item = {
      noticeId: n._id,
      sourceType: 'auction',
      sourceId: n.sourceId,
      itemIndex: 0,
      name: n.name,
      assetType: mapAssetType(n.propertyTypeName, n.name),
      province: n.province,
      district: ids.district || n.district,
      ward: ids.commune,
      identifiers: ids,
      ownerName: ids.ownerName || n.owner,
      startingPrice: n.initialPrice
    };
    item.blockingKeys = generateBlockingKeys(item);
    return item;
  });

  for (let i = 0; i < liveItems.length; i++) {
    for (let j = i + 1; j < liveItems.length; j++) {
      const itemA = liveItems[i];
      const itemB = liveItems[j];
      const res = scoreAssetPair(itemA, itemB);
      console.log(`Pair: ${itemA.sourceId} & ${itemB.sourceId}`);
      console.log(`Score: ${res.score}, Decision: ${res.decision}`);
      console.log(`Reasons:`, res.reasons);
      console.log(`Conflicts:`, res.conflicts);
      console.log('--------------------------------');
    }
  }

  await closeDB();
}

run().catch(console.error);
