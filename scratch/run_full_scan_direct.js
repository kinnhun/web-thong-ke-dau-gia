const mongoose = require('mongoose');
const { runFullDuplicateScan } = require('../bot-crawls-data/src/scrapers/detail.scraper');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  console.log('✅ Connected to MongoDB');

  console.log('Starting full duplicate scan...');
  const start = Date.now();
  await runFullDuplicateScan();
  const duration = Date.now() - start;
  console.log(`\nScan finished in ${duration} ms`);

  await mongoose.disconnect();
}

test().catch(console.error);
