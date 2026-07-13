const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const organizerName = "Trung tâm Dịch vụ bán đấu giá tài sản TPHCM";
    const orgRegex = new RegExp(organizerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const filter = { organizer: orgRegex };

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'duplicates',
          localField: 'sourceId',
          foreignField: 'sourceIds',
          as: 'dupDoc'
        }
      },
      {
        $addFields: {
          dupFiltered: {
            $filter: {
              input: '$dupDoc',
              as: 'd',
              cond: { $eq: ['$$d.type', 'auction'] }
            }
          }
        }
      },
      {
        $addFields: {
          dup: { $arrayElemAt: ['$dupFiltered', 0] }
        }
      },
      {
        $addFields: {
          groupKey: {
            $cond: {
              if: { $and: [{ $ne: ['$dup', null] }, { $ne: [{ $type: '$dup' }, 'missing'] }] },
              then: { $toString: '$dup._id' },
              else: { $toString: '$sourceId' }
            }
          },
          priceDropPercentVal: { $ifNull: ['$dup.priceDropPercent', 0] },
          reducedAmtVal: {
            $cond: {
              if: { $and: [{ $ne: ['$dup', null] }, { $ne: [{ $type: '$dup' }, 'missing'] }] },
              then: { $subtract: [{ $ifNull: ['$dup.firstPrice', 0] }, { $ifNull: ['$dup.latestPrice', 0] }] },
              else: 0
            }
          },
          relistCountVal: { $ifNull: ['$dup.relistCount', 1] }
        }
      },
      {
        $group: {
          _id: '$groupKey',
          latestNotice: { $first: '$$ROOT' },
          priceDropPercent: { $max: '$priceDropPercentVal' },
          reducedAmount: { $max: '$reducedAmtVal' },
          relistCount: { $max: '$relistCountVal' }
        }
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: 0 }, { $limit: 20 }]
        }
      }
    ];

    const aggregateResult = await AuctionNotice.aggregate(pipeline);
    const total = aggregateResult[0]?.metadata?.[0]?.total || 0;
    console.log(`Aggregate total is: ${total}`);

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
