const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const { syncAllAssetItems } = require('../src/scrapers/detail.scraper');

async function run() {
  console.log('Connecting to DB...');
  await connectDB();
  console.log('Connected.');

  console.log('Starting syncAllAssetItems test...');
  await syncAllAssetItems(msg => console.log(`[PROGRESS] ${msg}`));
  console.log('Sync finished successfully without errors!');

  await closeDB();
}

run().catch(err => {
  console.error('Error during sync test:', err);
  process.exit(1);
});
