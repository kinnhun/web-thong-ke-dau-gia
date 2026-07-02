const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  await connectDB();

  const ids = [408768, 280536];
  const notices = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();

  for (const n of notices) {
    console.log(`SourceId: ${n.sourceId}`);
    console.log(`Title: ${n.name}`);
    console.log(`Organizer: ${n.organizer}`);
    console.log(`Owner: ${n.owner}`);
    console.log(`Initial Price: ${n.initialPrice}`);
    console.log(`Address: ${n.address}`);
    console.log(`Short Description: ${n.shortDescription?.substring(0, 300)}...`);
    console.log('================================');
  }

  await closeDB();
}

run().catch(console.error);
