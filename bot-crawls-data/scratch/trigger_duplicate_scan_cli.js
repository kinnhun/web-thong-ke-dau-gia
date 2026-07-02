const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const { runFullDuplicateScan } = require('../src/scrapers/detail.scraper');

async function run() {
  await connectDB();
  console.log('Connected to MongoDB. Starting duplicate scan from CLI...');

  // Set skipDetailCrawl to true since we only need to map identifiers and rootIds
  // This will speed up the process by skipping crawling
  const { setSkipDetailCrawl } = require('../src/scrapers/detail.scraper');
  setSkipDetailCrawl(true);
  console.log('Skipping detail crawl during scan.');

  const progressCallback = (msg) => {
    console.log(`[PROGRESS] ${msg}`);
  };

  try {
    // Run the duplicate scan
    // Wait, runFullDuplicateScan does not accept parameters, it manages its own log.
    // Let's call it:
    await runFullDuplicateScan();
    console.log('Duplicate scan completed successfully!');
  } catch (err) {
    console.error('Error during duplicate scan:', err);
  } finally {
    await closeDB();
  }
}

run().catch(console.error);
