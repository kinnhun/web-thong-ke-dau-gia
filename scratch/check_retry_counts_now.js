const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function check() {
  await connectDB();
  try {
    const total = await AuctionNotice.countDocuments();
    const missingPrice = await AuctionNotice.countDocuments({
      $or: [
        { initialPrice: { $exists: false } },
        { initialPrice: null },
        { initialPrice: 0 }
      ]
    });

    const retryCounts = await AuctionNotice.aggregate([
      {
        $match: {
          $or: [
            { initialPrice: { $exists: false } },
            { initialPrice: null },
            { initialPrice: 0 }
          ]
        }
      },
      {
        $group: {
          _id: '$zeroPriceRetryCount',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('Total documents:', total);
    console.log('Missing price documents:', missingPrice);
    console.log('Retry count groups for missing price documents:', retryCounts);

  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

check();
