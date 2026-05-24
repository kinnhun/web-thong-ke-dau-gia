const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function test() {
  await connectDB();
  try {
    const items = await AuctionNotice.find({
      $and: [
        {
          $or: [
            { initialPrice: { $exists: false } },
            { initialPrice: null },
            { initialPrice: 0 }
          ]
        },
        { detailScraped: true }
      ]
    }).limit(3).lean();

    console.log(JSON.stringify(items, null, 2));
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

test();
