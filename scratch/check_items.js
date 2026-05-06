require('dotenv').config({ path: './bot-crawls-data/.env' });
const mongoose = require('mongoose');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');
const h = require('../bot-crawls-data/src/utils/helpers.js');

const sourceIds = [441901, 457469, 472434, 491001, 507358, 522961, 536469, 550839];

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  try {
    const items = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).lean();
    console.log(`Found ${items.length} items out of ${sourceIds.length}`);
    
    for (const item of items) {
      const core = h.extractCoreIdentity(item.name);
      const tokens = h.getNumberTokens(item.name);
      console.log(`[${item.sourceId}] Name: ${item.name}`);
      console.log(`      Core: ${core}`);
      console.log(`      Tokens: ${JSON.stringify(tokens)}`);
      console.log('---');
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
