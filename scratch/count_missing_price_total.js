const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function test() {
  await connectDB();
  try {
    const total = await AuctionNotice.countDocuments();
    const unscraped = await AuctionNotice.countDocuments({ detailScraped: { $ne: true } });
    const scrapedMissingPrice = await AuctionNotice.countDocuments({
      detailScraped: true,
      $or: [
        { initialPrice: { $exists: false } },
        { initialPrice: null },
        { initialPrice: 0 }
      ]
    });
    const totalMissingPrice = await AuctionNotice.countDocuments({
      $or: [
        { initialPrice: { $exists: false } },
        { initialPrice: null },
        { initialPrice: 0 }
      ]
    });

    console.log({
      total,
      unscraped,
      scrapedMissingPrice,
      totalMissingPrice
    });
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

test();
