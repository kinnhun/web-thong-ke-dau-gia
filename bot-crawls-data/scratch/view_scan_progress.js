const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const CrawlLog = require('../src/models/CrawlLog');

async function run() {
  await connectDB();

  const log = await CrawlLog.findOne({ type: 'duplicate_scan' }).sort({ createdAt: -1 }).lean();
  if (!log) {
    console.log('No duplicate scan crawl log found.');
  } else {
    console.log('--- Latest Crawl Log ---');
    console.log(`ID: ${log._id}`);
    console.log(`Status: ${log.status}`);
    console.log(`Started At: ${log.startedAt}`);
    console.log(`Finished At: ${log.finishedAt}`);
    console.log(`Pages Processed: ${log.pagesProcessed}`);
    console.log(`Items Updated: ${log.itemsUpdated}`);
    console.log(`Items Skipped: ${log.itemsSkipped}`);
    console.log('--- Last Progress Messages ---');
    if (Array.isArray(log.errorMessages)) {
      log.errorMessages.forEach(m => console.log(`- ${m}`));
    }
    console.log('------------------------------');
  }

  await closeDB();
}

run().catch(console.error);
