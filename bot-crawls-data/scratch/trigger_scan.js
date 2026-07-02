const mongoose = require('mongoose');
const { runFullDuplicateScan } = require('../src/scrapers/detail.scraper');

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  console.log('Database connected.');

  console.log('Starting full duplicate scan...');
  const start = Date.now();
  
  // Set skipDetailCrawl so it doesn't try to crawl detail pages from web, only groups local db.
  // This makes the scan run in 1-2 minutes!
  const { setSkipDetailCrawl } = require('../src/scrapers/detail.scraper');
  setSkipDetailCrawl(true);

  const result = await runFullDuplicateScan();
  console.log('Scan result:', result);

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Scan completed in ${duration} seconds.`);

  await mongoose.connection.close();
  console.log('Database disconnected. Exit.');
}

run().catch(err => {
  console.error('Scan error:', err);
  mongoose.disconnect();
});
