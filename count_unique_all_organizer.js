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
          }
        }
      },
      {
        $group: {
          _id: '$groupKey'
        }
      },
      { $count: 'total' }
    ];

    const results = await AuctionNotice.aggregate(pipeline);
    console.log(`Unique grouped notices count (all statuses):`, results[0]?.total);

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
