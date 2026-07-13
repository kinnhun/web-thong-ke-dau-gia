const mongoose = require('mongoose');
const CrawlLog = require('../src/models/CrawlLog');
const config = require('../src/config');

async function check() {
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB.');

  // Find all failed crawl logs
  const failedLogs = await CrawlLog.find({ status: 'failed' }).sort({ createdAt: -1 }).limit(10).lean();
  console.log(`=== FAILED CRAWL LOGS (Count: ${await CrawlLog.countDocuments({ status: 'failed' })}) ===`);
  for (const log of failedLogs) {
    console.log(`Type: ${log.type} | Started: ${log.startedAt.toLocaleString('vi-VN')} | Finished: ${log.finishedAt ? log.finishedAt.toLocaleString('vi-VN') : 'N/A'}`);
    console.log(`Errors:`);
    log.errorMessages.forEach(err => console.log(`  - ${err}`));
    console.log('-'.repeat(50));
  }

  // Count empty prices, deposits, organizers
  const AuctionNotice = require('../src/models/AuctionNotice');
  const emptyPrice = await AuctionNotice.countDocuments({ initialPrice: { $in: [null, 0] } });
  const emptyOrganizer = await AuctionNotice.countDocuments({ organizer: { $in: [null, ''] } });
  const emptyProvince = await AuctionNotice.countDocuments({ province: { $in: [null, ''] } });
  console.log('\n=== QUALITY CHECK ON AUCTION NOTICES ===');
  console.log(`Total AuctionNotices: ${await AuctionNotice.countDocuments({})}`);
  console.log(`Initial Price is 0 or null: ${emptyPrice}`);
  console.log(`Organizer is empty: ${emptyOrganizer}`);
  console.log(`Province is empty: ${emptyProvince}`);

  await mongoose.disconnect();
}

check().catch(console.error);
