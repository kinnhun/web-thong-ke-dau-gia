const mongoose = require('mongoose');
const CrawlLog = require('./src/models/CrawlLog');
require('dotenv').config();

async function checkLog() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  const logs = await CrawlLog.find({ type: 'duplicate_scan' }).sort({ createdAt: -1 }).limit(3).lean();
  console.log("Latest duplicate_scan logs:");
  logs.forEach(l => {
    console.log(`\nLog ID: ${l._id}`);
    console.log(`Time: ${l.startedAt}`);
    console.log(`Status: ${l.status}`);
    console.log(`Items Updated: ${l.itemsUpdated}`);
    console.log(`Messages:`, l.errorMessages);
  });
  process.exit(0);
}

checkLog().catch(console.error);
