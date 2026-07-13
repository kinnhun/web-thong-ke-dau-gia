const mongoose = require('mongoose');
const { runOrganizerDuplicateScan, setSkipDetailCrawl } = require('./bot-crawls-data/src/scrapers/detail.scraper');
const CrawlLog = require('./bot-crawls-data/src/models/CrawlLog');

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  console.log('Setting skipDetailCrawl to true...');
  setSkipDetailCrawl(true);

  const organizer = "Trung tâm dịch vụ bán đấu giá tài sản TPHCM";
  console.log(`Starting duplicate scan for organizer: "${organizer}"...`);

  // Create a log entry
  const log = await CrawlLog.create({
    type: 'organizer_duplicate_scan',
    status: 'running',
    startedAt: new Date(),
    errorMessages: [`Bắt đầu quét trùng lặp cho đơn vị: ${organizer}`]
  });

  const result = await runOrganizerDuplicateScan(organizer, log);
  console.log('Scan completed successfully:', result);

  // Print progress and logs
  const updatedLog = await CrawlLog.findById(log._id).lean();
  console.log('Final log status:', updatedLog.status);
  console.log('Messages:', updatedLog.errorMessages);

  await mongoose.connection.close();
}

run().catch(async err => {
  console.error('Error during rescan:', err);
  await mongoose.connection.close();
});
