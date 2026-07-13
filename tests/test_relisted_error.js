const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const { connectDB } = require('./bot-crawls-data/src/db');

async function test() {
  await connectDB();
  try {
    const dupFilter = {
      type: 'auction',
      relistCount: { $gt: 1 },
    };

    const noticeMatch = {
      latestNotice: { $ne: null },
      'latestNotice.organizer': { $regex: 'Trung tâm Dịch vụ bán đấu giá tài sản TPHCM', $options: 'i' }
    };

    function buildLatestNoticeLookupStages() {
      return [
        {
          $addFields: {
            latestSourceId: {
              $arrayElemAt: [{ $ifNull: ['$sourceIds', []] }, -1],
            },
            _latestPublishedAt: {
              $arrayElemAt: [{ $slice: [{ $ifNull: ['$entries.publishedAt', []] }, -1] }, 0],
            },
          },
        },
        {
          $lookup: {
            from: 'auctionnotices',
            localField: 'latestSourceId',
            foreignField: 'sourceId',
            as: 'latestNoticeLookup',
          },
        },
        {
          $addFields: {
            latestNotice: {
              $arrayElemAt: ['$latestNoticeLookup', 0],
            },
          },
        },
        {
          $project: {
            latestNoticeLookup: 0,
          },
        },
      ];
    }

    const filterPipeline = [
      { $match: dupFilter },
      ...buildLatestNoticeLookupStages(),
      { $match: noticeMatch }
    ];

    const sortStage = { $sort: { relistCount: -1, _latestPublishedAt: -1 } };

    const totalResult = await Duplicate.aggregate([...filterPipeline, { $count: 'total' }]);
    console.log("Total:", totalResult);

    const items = await Duplicate.aggregate([
      ...filterPipeline,
      sortStage,
      { $skip: 0 },
      { $limit: 20 },
    ]).allowDiskUse(true);

    console.log("Items count:", items.length);
  } catch (err) {
    console.error("Aggregation error:", err);
  }
  mongoose.disconnect();
}

test();
