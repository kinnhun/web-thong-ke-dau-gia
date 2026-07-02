const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const CrawlLog = require('../src/models/CrawlLog');

async function run() {
  await connectDB();

  console.log('Updating stuck crawl logs...');
  const res = await CrawlLog.updateMany(
    { status: 'running', type: { $in: ['duplicate_scan', 'organizer_duplicate_scan'] } },
    { $set: { status: 'failed', finishedAt: new Date(), errorMessages: ['Được dừng bởi reset_crawl_logs.js để chạy lại.'] } }
  );
  console.log(`Updated ${res.modifiedCount} logs.`);

  await closeDB();
}

run().catch(console.error);
