const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');
const { extractPropertyIdentifiers, mapAssetType } = require('../src/utils/helpers');

async function run() {
  await connectDB();

  const ids = [591191, 592519, 564858, 566741, 476677];

  console.log('=== KIỂM TRA CHI TIẾT CÁC TIN ĐĂNG ===\n');

  for (const id of ids) {
    const notice = await AuctionNotice.findOne({ sourceId: id }).lean();
    if (!notice) {
      console.log(`SourceId ${id}: KHÔNG TÌM THẤY trong DB\n`);
      continue;
    }

    console.log(`--- SourceId: ${id} ---`);
    console.log(`  Name: ${notice.name?.substring(0, 200)}`);
    console.log(`  RootId: ${notice.rootId || 'KHÔNG CÓ'}`);
    console.log(`  PublishRound: ${notice.publishRound || 'N/A'}`);
    console.log(`  Province: ${notice.province}`);
    console.log(`  Address: ${notice.address}`);
    console.log(`  Organizer: ${notice.organizer}`);
    console.log(`  Owner: ${notice.owner}`);
    console.log(`  InitialPrice: ${notice.initialPrice?.toLocaleString()}`);
    console.log(`  RelatedIds: ${JSON.stringify(notice.relatedIds)}`);
    
    // Check AssetItems
    const items = await AssetItem.find({ sourceId: id, sourceType: 'auction' }).lean();
    console.log(`  Số AssetItem: ${items.length}`);
    for (const item of items) {
      console.log(`    Item #${item.itemIndex}:`);
      console.log(`      Name: ${item.name?.substring(0, 150)}`);
      console.log(`      Identifiers: ${JSON.stringify(item.identifiers)}`);
      console.log(`      AssetType: ${item.assetType}`);
      console.log(`      Province: ${item.province}`);
      console.log(`      District: ${item.district}`);
      console.log(`      Ward: ${item.ward}`);
      console.log(`      StartingPrice: ${item.startingPrice?.toLocaleString()}`);
    }
    
    // Check Duplicate record
    const dup = await Duplicate.findOne({ 
      $or: [
        { sourceId: id, sourceType: 'auction' },
        { 'entries.sourceId': id }
      ]
    }).lean();
    if (dup) {
      console.log(`  Duplicate record: rootId=${dup.rootId}, entries=${dup.entries?.length}`);
      if (dup.entries) {
        for (const e of dup.entries) {
          console.log(`    entry: sourceId=${e.sourceId}, round=${e.publishRound}`);
        }
      }
    } else {
      console.log(`  Duplicate record: KHÔNG CÓ`);
    }
    
    console.log('');
  }

  // Now test: what identifiers does the CURRENT code extract?
  console.log('\n=== KIỂM TRA IDENTIFIERS TRÍCH XUẤT BỞI CODE HIỆN TẠI ===\n');
  for (const id of ids) {
    const notice = await AuctionNotice.findOne({ sourceId: id }).lean();
    if (!notice) continue;
    
    const rawText = `${notice.name || ''} ${notice.address || ''}`;
    const identifiers = extractPropertyIdentifiers(rawText);
    const assetType = mapAssetType(rawText);
    
    console.log(`SourceId ${id}:`);
    console.log(`  Extracted identifiers: ${JSON.stringify(identifiers)}`);
    console.log(`  Extracted assetType: ${assetType}`);
    console.log('');
  }

  // Check if any of these share relatedIds
  console.log('\n=== KIỂM TRA RELATED IDS ===\n');
  for (const id of ids) {
    const notice = await AuctionNotice.findOne({ sourceId: id }).lean();
    if (!notice) continue;
    const related = notice.relatedIds || [];
    const overlapping = related.filter(r => ids.includes(r));
    console.log(`SourceId ${id}: relatedIds=${JSON.stringify(related)}, overlap with our set: ${JSON.stringify(overlapping)}`);
  }

  await closeDB();
}

run().catch(console.error);
