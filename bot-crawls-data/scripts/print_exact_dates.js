const mongoose = require('mongoose');
const config = require('../src/config');
const AuctionNotice = require('../src/models/AuctionNotice');

async function printExactDates() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected DB');

  const items = await AuctionNotice.find({ sourceId: { $gt: 620000 } }).sort({ sourceId: -1 }).limit(10).lean();
  
  console.log(`Found ${items.length} items > 620000:`);
  items.forEach(i => {
    console.log({
      sourceId: i.sourceId,
      publishedAt: i.publishedAt,
      publishedAtISO: i.publishedAt ? new Date(i.publishedAt).toISOString() : null,
      pub1: i.publishTime1,
      pub2: i.publishTime2
    });
  });

  await mongoose.disconnect();
}

printExactDates().catch(console.error);
