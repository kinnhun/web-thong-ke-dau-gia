const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  await connectDB();

  const orgNamePattern = /Trung tâm Dịch vụ bán đấu giá tài sản TP.*HCM/i;
  const count = await AuctionNotice.countDocuments({ organizer: orgNamePattern });
  console.log(`Total notices under organizer: ${count}`);

  const notices = await AuctionNotice.find({ organizer: orgNamePattern })
    .select('sourceId name province address initialPrice relatedIds')
    .limit(100)
    .lean();

  console.log('--- Sample 100 notices ---');
  notices.forEach(n => {
    console.log(`[${n.sourceId}] Price: ${n.initialPrice} | Prov: ${n.province} | Name: ${n.name.substring(0, 150)}...`);
  });

  await closeDB();
}

run().catch(console.error);
