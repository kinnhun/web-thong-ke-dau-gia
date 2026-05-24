const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const { fetchAPI } = require('../bot-crawls-data/src/browser');

async function debug() {
  await connectDB();
  try {
    const sourceId = 573235;
    console.log(`Calling viewDetailAuctionInfo for ${sourceId}...`);
    const res = await fetchAPI('/portal/viewDetailAuctionInfo', { auctionInfoId: sourceId });
    console.log('viewDetail keys:', Object.keys(res));
    console.log('viewDetail full JSON:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

debug();
