const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  await connectDB();

  // Find all AssetItems with plotNumber '137'
  const items = await AssetItem.find({ 
    'identifiers.plotNumber': '137',
    sourceType: 'auction'
  }).lean();

  console.log(`\n=== Tìm thấy ${items.length} AssetItem có thửa đất số 137 ===\n`);

  // Group by sourceId
  const bySource = {};
  for (const item of items) {
    if (!bySource[item.sourceId]) bySource[item.sourceId] = [];
    bySource[item.sourceId].push(item);
  }

  console.log(`Số tin đăng chứa thửa 137: ${Object.keys(bySource).length}\n`);

  // Get all sourceIds
  const sourceIds = Object.keys(bySource).map(Number);
  
  // Fetch notice details
  const notices = await AuctionNotice.find({ sourceId: { $in: sourceIds } })
    .select('sourceId name organizer owner address province rootId publishRound initialPrice')
    .lean();

  const noticeMap = {};
  for (const n of notices) {
    noticeMap[n.sourceId] = n;
  }

  // Group by rootId to see which ones are already grouped
  const byRootId = {};
  
  for (const sourceId of sourceIds) {
    const notice = noticeMap[sourceId];
    const assetItems = bySource[sourceId];
    
    const rootId = notice?.rootId || `no_root_${sourceId}`;
    if (!byRootId[rootId]) byRootId[rootId] = [];
    byRootId[rootId].push(sourceId);
    
    console.log(`--- SourceId: ${sourceId} ---`);
    console.log(`  RootId: ${notice?.rootId || 'KHÔNG CÓ'}`);
    console.log(`  Round: ${notice?.publishRound || 'N/A'}`);
    console.log(`  Organizer: ${notice?.organizer}`);
    console.log(`  Owner: ${notice?.owner}`);
    console.log(`  Province: ${notice?.province}`);
    console.log(`  InitialPrice: ${notice?.initialPrice?.toLocaleString()}`);
    console.log(`  Số AssetItem trong tin: ${assetItems.length}`);
    
    // Show the specific item(s) with plot 137
    for (const ai of assetItems) {
      if (ai.identifiers?.plotNumber === '137') {
        console.log(`  >>> AssetItem #${ai.itemIndex}:`);
        console.log(`      Name: ${ai.name?.substring(0, 120)}...`);
        console.log(`      Identifiers: ${JSON.stringify(ai.identifiers)}`);
        console.log(`      AssetType: ${ai.assetType}`);
        console.log(`      District: ${ai.district}, Ward: ${ai.ward}`);
        console.log(`      StartingPrice: ${ai.startingPrice?.toLocaleString() || 'N/A'}`);
        console.log(`      RootId: ${ai.rootId || 'KHÔNG CÓ'}`);
      }
    }
    console.log('');
  }

  // Summary of grouping
  console.log(`\n=== PHÂN TÍCH GOM NHÓM ===`);
  console.log(`Tổng số rootId khác nhau: ${Object.keys(byRootId).length}`);
  for (const [rootId, ids] of Object.entries(byRootId)) {
    console.log(`  RootId ${rootId}: ${ids.length} tin đăng -> [${ids.join(', ')}]`);
  }

  // Find items that share the same district+ward+mapSheet for plot 137
  console.log(`\n=== NHÓM THEO ĐỊA CHỈ (cùng huyện/xã + tờ bản đồ) ===`);
  const byLocation = {};
  for (const item of items) {
    if (item.identifiers?.plotNumber !== '137') continue;
    const key = `${item.district || '?'}|${item.ward || '?'}|sheet:${item.identifiers?.mapSheet || '?'}`;
    if (!byLocation[key]) byLocation[key] = [];
    byLocation[key].push({
      sourceId: item.sourceId,
      itemIndex: item.itemIndex,
      name: item.name?.substring(0, 80),
      rootId: item.rootId,
      price: item.startingPrice,
    });
  }
  
  for (const [loc, group] of Object.entries(byLocation)) {
    console.log(`\n  Vị trí: ${loc} (${group.length} bản ghi)`);
    for (const g of group) {
      console.log(`    sourceId=${g.sourceId}, item#${g.itemIndex}, rootId=${g.rootId || 'NONE'}, price=${g.price?.toLocaleString() || 'N/A'}`);
      console.log(`      ${g.name}...`);
    }
  }

  await closeDB();
}

run().catch(console.error);
