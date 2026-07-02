const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
require('../src/models/Duplicate'); // Register schema

async function run() {
  await connectDB();
  try {
    const filter = { organizer: /Trung tâm Dịch vụ bán đấu giá tài sản TPHCM/i };
    const skip = 0;
    const limit = 5;

    console.log("Running aggregation test with sort 'discount_pct' (OPTIMIZED)...");
    const startTime = Date.now();

    const pipeline = [
      { $match: filter },
      { $sort: { publishedAt: -1, sourceId: -1 } },
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
        $sort: { priceDropPercent: -1, 'latestNotice.publishedAt': -1 }
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const result = await AuctionNotice.aggregate(pipeline);
    const total = result[0]?.metadata?.[0]?.total || 0;
    const items = result[0]?.data || [];

    const duration = Date.now() - startTime;
    console.log(`Query completed in ${duration}ms`);
    console.log(`Total grouped items: ${total}`);
    console.log(`Returned page size: ${items.length}`);
    items.forEach((item, idx) => {
      console.log(`[${idx}] SourceId: ${item.latestNotice.sourceId}, Name: ${item.latestNotice.name.slice(0, 50)}...`);
      console.log(`    Lần: ${item.relistCount}, % Giảm: ${item.priceDropPercent}%, Số tiền giảm: ${item.reducedAmount}`);
    });
  } catch (err) {
    console.error("Aggregation query failed:", err);
  } finally {
    await closeDB();
  }
}

run();
