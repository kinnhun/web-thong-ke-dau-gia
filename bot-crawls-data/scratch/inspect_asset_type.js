const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');

async function run() {
  await connectDB();

  const ids = [476576, 543134, 454852, 471403, 561763];
  const items = await AssetItem.find({ sourceId: { $in: ids } }).lean();

  console.log('--- Inspecting AssetItems ---');
  items.forEach(item => {
    console.log(`SourceId: ${item.sourceId}`);
    console.log(`AssetType: ${item.assetType}`);
    console.log(`Name: ${item.name.substring(0, 100)}...`);
    console.log('--------------------------------');
  });

  await closeDB();
}

run().catch(console.error);
