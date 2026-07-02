const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  await connectDB();

  const ids = [476576, 543134];
  const notices = await AuctionNotice.find({ sourceId: { $in: ids } }).select('sourceId propertyTypeName name').lean();

  notices.forEach(n => {
    console.log(`SourceId: ${n.sourceId}`);
    console.log(`PropertyTypeName: "${n.propertyTypeName}"`);
    console.log(`Name: ${n.name.substring(0, 150)}...`);
    console.log('--------------------------------');
  });

  await closeDB();
}

run().catch(console.error);
