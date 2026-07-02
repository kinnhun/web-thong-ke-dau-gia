const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');

async function run() {
  await connectDB();

  const ids = [408768, 280536, 468143, 209153];
  const items = await AssetItem.find({ sourceId: { $in: ids } }).lean();

  for (const item of items) {
    console.log(`SourceId: ${item.sourceId}`);
    console.log(`Name: ${item.name}`);
    console.log(`Area: ${item.area}`);
    console.log(`Price: ${item.startingPrice}`);
    console.log(`Identifiers:`, item.identifiers);
    console.log('--------------------------------');
  }

  await closeDB();
}

run().catch(console.error);
