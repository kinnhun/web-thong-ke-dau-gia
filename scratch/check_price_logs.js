const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const CrawlLog = require('../bot-crawls-data/src/models/CrawlLog');

async function test() {
  await connectDB();
  try {
    const logs = await CrawlLog.find({ type: 'recrawl_missing_price' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    console.log('Recent recrawl_missing_price logs:');
    console.log(JSON.stringify(logs.map(l => ({
      status: l.status,
      startedAt: l.startedAt,
      finishedAt: l.finishedAt,
      totalPages: l.totalPages,
      pagesProcessed: l.pagesProcessed,
      itemsUpdated: l.itemsUpdated,
      itemsSkipped: l.itemsSkipped,
      errors: l.errorMessages ? l.errorMessages.slice(-2) : []
    })), null, 2));
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

test();
