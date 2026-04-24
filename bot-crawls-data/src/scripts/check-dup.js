require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Dup = require('../models/Duplicate');

(async () => {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  const d = await Dup.findOne({ sourceIds: 561477 }).lean();
  if (!d) { console.log('Not found'); process.exit(0); }
  console.log(JSON.stringify({
    name: d.name,
    sourceIds: d.sourceIds,
    entries: d.entries.map(e => ({ sourceId: e.sourceId, price: e.price, publishedAt: e.publishedAt })),
    firstPrice: d.firstPrice,
    latestPrice: d.latestPrice,
    isPriceDrop: d.isPriceDrop,
    priceDropPercent: d.priceDropPercent,
  }, null, 2));
  process.exit(0);
})();
