require('dotenv').config({ path: './bot-crawls-data/.env' });
const mongoose = require('mongoose');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

const sourceIds = [441901, 457469, 472434, 491001, 507358, 522961, 536469, 550839];

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  const items = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).select('sourceId province').lean();
  console.log(items);
  mongoose.disconnect();
});
