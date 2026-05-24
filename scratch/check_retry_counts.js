const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function test() {
  await connectDB();
  try {
    const total = await AuctionNotice.countDocuments();
    const countExist = await AuctionNotice.countDocuments({ zeroPriceRetryCount: { $exists: true } });
    const countGtZero = await AuctionNotice.countDocuments({ zeroPriceRetryCount: { $gt: 0 } });
    const countLtTwo = await AuctionNotice.countDocuments({
      $or: [
        { zeroPriceRetryCount: { $exists: false } },
        { zeroPriceRetryCount: { $lt: 2 } }
      ]
    });
    const missingPriceAndLtTwo = await AuctionNotice.countDocuments({
      $and: [
        {
          $or: [
            { initialPrice: { $exists: false } },
            { initialPrice: null },
            { initialPrice: 0 }
          ]
        },
        {
          $or: [
            { zeroPriceRetryCount: { $exists: false } },
            { zeroPriceRetryCount: { $lt: 2 } }
          ]
        }
      ]
    });

    console.log({
      total,
      countExist,
      countGtZero,
      countLtTwo,
      missingPriceAndLtTwo
    });
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

test();
