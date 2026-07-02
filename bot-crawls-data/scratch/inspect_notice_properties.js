const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  await connectDB();

  const notice = await AuctionNotice.findOne({ sourceId: 87339 }).lean();
  console.log('Notice Name:', notice.name);
  console.log('Notice properties:', JSON.stringify(notice.properties, null, 2));

  await closeDB();
}

run().catch(console.error);
