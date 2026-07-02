const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  await connectDB();

  const notice = await AuctionNotice.findOne({ sourceId: 280536 }).lean();
  if (notice) {
    console.log(`--- AuctionNotice 280536 ---`);
    console.log(`SourceId: ${notice.sourceId}`);
    console.log(`Name: ${notice.name}`);
    console.log(`Organizer: ${notice.organizer}`);
    console.log(`InitialPrice: ${notice.initialPrice}`);
    console.log(`Properties:`, notice.properties);
  } else {
    console.log(`AuctionNotice 280536 NOT FOUND!`);
  }

  const items = await AssetItem.find({ sourceId: 280536 }).lean();
  console.log(`--- AssetItems for 280536 ---`);
  items.forEach(item => {
    console.log(`Name: ${item.name}`);
    console.log(`Price: ${item.startingPrice}`);
    console.log(`Identifiers:`, item.identifiers);
  });

  await closeDB();
}

run().catch(console.error);
