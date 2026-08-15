const mongoose = require('mongoose');
const config = require('../src/config');
const AuctionNotice = require('../src/models/AuctionNotice');

async function printMaxSourceId() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected DB');

  const top10 = await AuctionNotice.find({}, { sourceId: 1, publishedAt: 1, name: 1 }).sort({ sourceId: -1 }).limit(10).lean();
  console.log('Top 10 highest sourceId in MongoDB:', top10);

  await mongoose.disconnect();
}

printMaxSourceId().catch(console.error);
