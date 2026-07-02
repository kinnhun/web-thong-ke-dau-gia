const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const { extractPropertyIdentifiers } = require('../src/utils/helpers');

async function run() {
  await connectDB();

  console.log('Searching in AuctionNotice...');
  // Find notices containing "thửa đất số 137" or similar
  const notices = await AuctionNotice.find({
    $or: [
      { name: /thửa đất số 137/i },
      { name: /thửa 137/i },
      { 'properties.name': /thửa đất số 137/i },
      { 'properties.name': /thửa 137/i }
    ]
  }).limit(100).lean();

  console.log(`Found ${notices.length} notices in AuctionNotice matching query.`);
  
  if (notices.length > 0) {
    console.log('Sample notices:');
    notices.slice(0, 10).forEach(n => {
      console.log(`- ID: ${n.sourceId}, Name: "${n.name.substring(0, 120)}...", Province: ${n.province}, District: ${n.district}`);
      const ids = extractPropertyIdentifiers(n.name);
      console.log(`  Extracted Identifiers:`, ids);
    });

    // Count by province/district to see where they are distributed
    const dist = {};
    notices.forEach(n => {
      const key = `${n.province || 'Unknown'} - ${n.district || 'Unknown'}`;
      dist[key] = (dist[key] || 0) + 1;
    });
    console.log('\nDistribution by Province - District:', dist);
  }

  // Also check AssetItem if populated
  const assetItems = await AssetItem.find({
    $or: [
      { name: /thửa đất số 137/i },
      { name: /thửa 137/i },
      { 'identifiers.plotNumber': '137' }
    ]
  }).limit(100).lean();
  console.log(`\nFound ${assetItems.length} asset items in AssetItem matching query.`);
  if (assetItems.length > 0) {
    console.log('Sample AssetItem entries:');
    assetItems.slice(0, 10).forEach(ai => {
      console.log(`- ID: ${ai.sourceId}, Name: "${ai.name.substring(0, 120)}...", Province: ${ai.province}, Ward: ${ai.ward}, Plot: ${ai.identifiers?.plotNumber}, Map: ${ai.identifiers?.mapSheet}`);
      console.log(`  Blocking Keys:`, ai.blockingKeys);
    });
  }

  await closeDB();
}

run().catch(console.error);
