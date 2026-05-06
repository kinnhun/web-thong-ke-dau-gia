const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/auction-data');
  const sample = await AuctionNotice.findOne({ auctionDate: { $exists: true } });
  console.log('Sample AuctionNotice:');
  console.log(JSON.stringify(sample, null, 2));
  process.exit();
}

check();
