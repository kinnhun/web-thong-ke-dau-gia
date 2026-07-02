const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  await connectDB();

  const sourceIds = [562633, 562631, 562632, 562971];
  const notices = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).lean();

  console.log('--- Database AuctionNotices ---');
  notices.forEach(n => {
    console.log(`SourceID: ${n.sourceId}`);
    console.log(`Name: ${n.name}`);
    console.log(`Province: ${n.province}`);
    console.log(`Address: ${n.address}`);
    console.log('--------------------------------');
  });

  await closeDB();
}

run().catch(console.error);
