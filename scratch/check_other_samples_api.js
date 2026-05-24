const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');
const { fetchAPI } = require('../bot-crawls-data/src/browser');

async function check() {
  await connectDB();
  try {
    const samples = await AuctionNotice.find({
      detailScraped: true,
      $or: [
        { initialPrice: { $exists: false } },
        { initialPrice: null },
        { initialPrice: 0 }
      ]
    }).limit(5).select({ sourceId: 1 }).lean();

    console.log('Found missing price samples in DB:', samples.map(s => s.sourceId));

    for (const sample of samples) {
      console.log(`\nFetching live API for sourceId: ${sample.sourceId}...`);
      const propResult = await fetchAPI('/portal/propertyInfo', { auctionInfoId: sample.sourceId });
      if (propResult && propResult.items && propResult.items.length > 0) {
        console.log(`Live propertyStartPrice:`, propResult.items[0].propertyStartPrice);
        console.log(`Live strPropertyStartPrice:`, propResult.items[0].strPropertyStartPrice);
      } else {
        console.log(`No items returned for sourceId: ${sample.sourceId}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

check();
