const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function check() {
  await connectDB();
  try {
    const doc = await AuctionNotice.findOne({ name: { $regex: 'lô số 84', $options: 'i' } }).lean();
    if (doc) {
      console.log('Found document:');
      console.log('sourceId:', doc.sourceId);
      console.log('initialPrice:', doc.initialPrice);
      console.log('zeroPriceRetryCount:', doc.zeroPriceRetryCount);
      console.log('detailScraped:', doc.detailScraped);
      console.log('properties:', JSON.stringify(doc.properties, null, 2));
      console.log('sourceUrl:', doc.sourceUrl);
    } else {
      console.log('Not found');
    }
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

check();
