const mongoose = require('mongoose');
const config = require('../src/config');
const Duplicate = require('../src/models/Duplicate');

async function test() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ DB Connected');

  const top = await Duplicate.aggregate([
    { $match: { isPriceDrop: true, type: 'auction', priceDropPercent: { $gt: 0 } } },
    { $sort: { priceDropPercent: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'auctionnotices',
        let: { sourceIds: '$sourceIds' },
        pipeline: [
          { $match: { $expr: { $in: ['$sourceId', '$$sourceIds'] } } },
          { $sort: { publishedAt: -1 } },
          { $limit: 1 }
        ],
        as: 'latestNoticeArray'
      }
    },
    { $addFields: { latestNotice: { $arrayElemAt: ['$latestNoticeArray', 0] } } }
  ]);

  console.log('✅ Top Discounted Results Count:', top.length);
  await mongoose.disconnect();
}

test().catch(console.error);
