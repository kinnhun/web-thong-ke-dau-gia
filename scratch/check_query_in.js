const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function test() {
  await connectDB();
  try {
    const count = await AuctionNotice.countDocuments({ initialPrice: { $in: [null, 0] } });
    console.log('Count of missing price via $in [null, 0]:', count);
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

test();
