const mongoose = require('mongoose');
const CrawlLog = require('../src/models/CrawlLog');
const config = require('../src/config');

async function check() {
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB.');

  // Find the latest 10 logs
  const logs = await CrawlLog.find({}).sort({ createdAt: -1 }).limit(10).lean();
  console.log('=== LATEST 10 CRAWL LOGS ===');
  for (const log of logs) {
    console.log(`Type: ${log.type} | Status: ${log.status} | Started: ${log.startedAt.toLocaleString('vi-VN')} | Finished: ${log.finishedAt ? log.finishedAt.toLocaleString('vi-VN') : 'N/A'}`);
    console.log(`Inserted: ${log.itemsInserted} | Updated: ${log.itemsUpdated} | Skipped: ${log.itemsSkipped} | Pages: ${log.pagesProcessed}/${log.totalPages}`);
    if (log.errorMessages && log.errorMessages.length > 0) {
      console.log('Errors:');
      log.errorMessages.slice(0, 5).forEach(err => console.log(`  - ${err}`));
      if (log.errorMessages.length > 5) {
        console.log(`  ... and ${log.errorMessages.length - 5} more errors`);
      }
    }
    console.log('-'.repeat(50));
  }

  // Count docs in AuctionNotice that don't have detailScraped: true
  const AuctionNotice = require('../src/models/AuctionNotice');
  const totalNotices = await AuctionNotice.countDocuments({});
  const unscrapedNotices = await AuctionNotice.countDocuments({ detailScraped: false });
  console.log(`\n=== AUCTION NOTICE DETAIL SCRAPED STATUS ===`);
  console.log(`Total AuctionNotices in DB: ${totalNotices}`);
  console.log(`Unscraped (detailScraped: false): ${unscrapedNotices}`);
  console.log(`Scraped (detailScraped: true): ${totalNotices - unscrapedNotices}`);

  await mongoose.disconnect();
}

check().catch(console.error);
