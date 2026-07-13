const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  console.log('Finding AuctionNotice with sourceId: 29626...');
  const rootNotice = await AuctionNotice.findOne({ sourceId: 29626 });
  if (rootNotice) {
    console.log('Found rootNotice:', rootNotice.sourceId);
    console.log('Name:', rootNotice.name);
    console.log('rootId:', rootNotice.rootId);
    console.log('relatedIds:', rootNotice.relatedIds);
  } else {
    console.log('No AuctionNotice found with sourceId: 29626');
  }

  // Find a few samples with rootId: 29626 and log their original raw API response or crawled fields if stored
  console.log('\nFetching some notices with rootId: 29626:');
  const samples = await AuctionNotice.find({ rootId: 29626 }).limit(10).lean();
  for (const sample of samples) {
    console.log(`- ID: ${sample.sourceId}`);
    console.log(`  Name: ${sample.name}`);
    console.log(`  publishRoundLabel: ${sample.publishRoundLabel}`);
    console.log(`  relatedIds: ${JSON.stringify(sample.relatedIds)}`);
  }

  await mongoose.connection.close();
}

run().catch(console.error);
