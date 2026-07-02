const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
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

  const sourceIds = [239759, 241186, 566731];
  console.log('--- Inspecting AuctionNotices and running LIVE extraction ---');
  const notices = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).lean();
  
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

  liveItems.forEach(item => {
    console.log(`SourceID: ${item.sourceId}`);
    console.log(`Name: "${item.name}"`);
    console.log(`Extracted Identifiers:`, item.identifiers);
    console.log(`Blocking Keys:`, item.blockingKeys);
    console.log('--------------------------------');
  });

  console.log('--- Pairwise scoring on LIVE extracted items ---');
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
