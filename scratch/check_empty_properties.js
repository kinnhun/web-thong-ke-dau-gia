const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function test() {
  await connectDB();
  try {
    const totalScraped = await AuctionNotice.countDocuments({ detailScraped: true });
    const emptyProperties = await AuctionNotice.countDocuments({
      detailScraped: true,
      $or: [
        { properties: { $exists: false } },
        { properties: { $size: 0 } }
      ]
    });
    const missingPriceWithProperties = await AuctionNotice.countDocuments({
      detailScraped: true,
      properties: { $exists: true, $not: { $size: 0 } },
      $or: [
        { initialPrice: { $exists: false } },
        { initialPrice: null },
        { initialPrice: 0 }
      ]
    });

    console.log({
      totalScraped,
      emptyProperties,
      missingPriceWithProperties
    });
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

test();
