const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const { isBatchNotice, extractPropertyIdentifiers, getBigrams, hasConflictingIdentifiers, hasMatchingStrongIdentifiers, jaccardSimilarity } = require('./bot-crawls-data/src/utils/helpers');

// Copy logic of buildDuplicateGroupResponse and enrichAuctionWithDuplicate here
async function buildDuplicateGroupResponse(dup, currentItem, ModelToUse) {
  if (!dup) return null;

  const groupNotices = await ModelToUse.find({ sourceId: { $in: dup.sourceIds || [] } })
    .select('sourceId name')
    .lean();
  const noticeMap = new Map(groupNotices.map(n => [n.sourceId, n]));

  const currentIsBatch = isBatchNotice(currentItem.name);
  let filteredEntries = dup.entries || [];

  if (!currentIsBatch) {
    const idsItem = extractPropertyIdentifiers(currentItem.name);
    const bigramsItem = getBigrams(currentItem.name);

    const batchSourceIds = filteredEntries.map(e => e.sourceId);
    const AssetItem = require('./bot-crawls-data/src/models/AssetItem');
    const assetItems = await AssetItem.find({
      sourceId: { $in: batchSourceIds }
    }).lean();

    const batchAssetMap = new Map();
    assetItems.forEach(item => {
      const idsEntry = item.identifiers || {};
      if (hasConflictingIdentifiers(idsItem, idsEntry)) {
        return;
      }
      if (hasMatchingStrongIdentifiers(idsItem, idsEntry)) {
        batchAssetMap.set(item.sourceId, item);
      }
    });

    filteredEntries = filteredEntries.filter(entry => {
      if (entry.sourceId === currentItem.sourceId) return true;

      const entryNotice = noticeMap.get(entry.sourceId);
      if (!entryNotice) return true;

      if (isBatchNotice(entryNotice.name)) {
        return batchAssetMap.has(entry.sourceId);
      }

      const idsEntry = extractPropertyIdentifiers(entryNotice.name);
      if (hasConflictingIdentifiers(idsItem, idsEntry)) {
        return false;
      }

      const isMatch = hasMatchingStrongIdentifiers(idsItem, idsEntry) || (jaccardSimilarity(bigramsItem, getBigrams(entryNotice.name)) >= 0.4);
      return isMatch;
    });

    filteredEntries = filteredEntries.map(entry => {
      const entryNotice = noticeMap.get(entry.sourceId);
      if (entryNotice && isBatchNotice(entryNotice.name)) {
        const matchAsset = batchAssetMap.get(entry.sourceId);
        if (matchAsset && matchAsset.startingPrice) {
          return {
            ...entry,
            price: matchAsset.startingPrice
          };
        }
      }
      return entry;
    });
  }

  let firstPrice = dup.firstPrice || 0;
  let latestPrice = dup.latestPrice || 0;
  let priceDropPercent = dup.priceDropPercent || 0;
  let isPriceDrop = dup.isPriceDrop || false;

  if (filteredEntries.length > 0) {
    firstPrice = filteredEntries[0].price || firstPrice;
    latestPrice = filteredEntries[filteredEntries.length - 1].price || latestPrice;
    if (filteredEntries.length > 1 && firstPrice > 0) {
      const diff = firstPrice - latestPrice;
      priceDropPercent = Math.round((diff / firstPrice) * 10000) / 100;
      isPriceDrop = diff > 0;
    } else {
      priceDropPercent = 0;
      isPriceDrop = false;
    }
  }

  return {
    id: dup._id.toString(),
    name: currentIsBatch ? dup.name : currentItem.name,
    relistCount: new Set(filteredEntries.map(e => e.publishRound).filter(r => r > 0)).size || filteredEntries.length,
    isPriceDrop,
    priceDropPercent,
    firstPrice,
    latestPrice,
    entries: filteredEntries,
  };
}

async function enrichAuctionWithDuplicate(item, dup, ModelToUse) {
  const transformed = {
    sourceId: item.sourceId,
    name: item.name,
    initialPrice: item.initialPrice,
    currentPrice: item.currentPrice,
    publishedAt: item.publishedAt,
    status: item.status
  };
  if (dup) {
    const dupRes = await buildDuplicateGroupResponse(dup, item, ModelToUse);
    if (dupRes) {
      return {
        ...transformed,
        initialPrice: dupRes.firstPrice,
        currentPrice: dupRes.latestPrice,
        priceDropPercent: dupRes.priceDropPercent
      };
    }
  }
  return {
    ...transformed,
    priceDropPercent: 0
  };
}

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const organizerName = "Trung tâm Dịch vụ bán đấu giá tài sản TPHCM";
    const orgRegex = new RegExp(organizerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const filter = {
      organizer: orgRegex,
      status: 'receiving_docs'
    };

    const page = 1;
    const limit = 20;
    const skip = (page - 1) * limit;

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
      { $sort: { priceDropPercent: -1, 'latestNotice.publishedAt': -1 } },
      // FACET PAGINATION (exactly like API)
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const aggregateResult = await AuctionNotice.aggregate(pipeline);
    const total = aggregateResult[0]?.metadata?.[0]?.total || 0;
    const rawGroupedItems = aggregateResult[0]?.data || [];

    let enrichedItems = await Promise.all(rawGroupedItems.map(g => {
      const item = g.latestNotice;
      const dup = item.dup;
      return enrichAuctionWithDuplicate(item, dup, AuctionNotice);
    }));

    // Post-sort like we just added
    enrichedItems.sort((a, b) => (b.priceDropPercent || 0) - (a.priceDropPercent || 0));

    console.log(`API returned items count: ${enrichedItems.length}`);
    enrichedItems.forEach((item, idx) => {
      console.log(`- [${idx}] sourceId: ${item.sourceId}, priceDropPercent: ${item.priceDropPercent}%, status: ${item.status}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
