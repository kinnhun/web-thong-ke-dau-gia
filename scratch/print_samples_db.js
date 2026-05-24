const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function test() {
  await connectDB();
  try {
    const items = await AuctionNotice.find({
      sourceId: { $in: [573057, 573056, 573055] }
    }).lean();

    console.log(JSON.stringify(items, null, 2));
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

test();
