require('dotenv').config({ path: './bot-crawls-data/.env' });
const mongoose = require('mongoose');
const { searchDuplicatesByFuzzyName } = require('./bot-crawls-data/src/scrapers/detail.scraper');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const h = require('./bot-crawls-data/src/utils/helpers.js');

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  try {
    const s1 = await AuctionNotice.findOne({ sourceId: 562920 }).lean();
    console.log('Item 562920:', s1.name);
    const related = await searchDuplicatesByFuzzyName(562920, s1.name, 'auction');
    console.log('Related IDs returned:', related);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
