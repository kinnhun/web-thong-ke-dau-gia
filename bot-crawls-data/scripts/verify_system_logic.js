const mongoose = require('mongoose');
const config = require('../src/config');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

async function verifyLogic() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Đã kết nối MongoDB để kiểm tra logic dữ liệu...');

  // 1. Kiểm tra AuctionNotice
  const totalAuctions = await AuctionNotice.countDocuments();
  const nullDatesCount = await AuctionNotice.countDocuments({
    $or: [{ publishedAt: null }, { publishedAt: { $exists: false } }]
  });
  console.log(`📊 Total AuctionNotices: ${totalAuctions.toLocaleString()}`);
  console.log(`📅 AuctionNotices with NULL publishedAt: ${nullDatesCount} (Phải = 0)`);

  // 2. Kiểm tra AssetItem
  const totalAssetItems = await AssetItem.countDocuments();
  const sampleAssetItem = await AssetItem.findOne({ blockingKeys: { $not: { $size: 0 } } }).lean();
  console.log(`📦 Total AssetItems: ${totalAssetItems.toLocaleString()}`);
  if (sampleAssetItem) {
    console.log(`🔍 Sample AssetItem:`, {
      name: sampleAssetItem.name,
      assetType: sampleAssetItem.assetType,
      province: sampleAssetItem.province,
      publishedAt: sampleAssetItem.publishedAt,
      blockingKeys: sampleAssetItem.blockingKeys
    });
  }

  // 3. Kiểm tra Duplicate
  const totalDuplicates = await Duplicate.countDocuments();
  const multiRelistDuplicates = await Duplicate.countDocuments({ relistCount: { $gt: 1 } });
  const priceDropDuplicates = await Duplicate.countDocuments({ isPriceDrop: true });
  console.log(`🔗 Total Duplicate Groups: ${totalDuplicates.toLocaleString()}`);
  console.log(`🔄 Relisted (>1 round) Groups: ${multiRelistDuplicates.toLocaleString()}`);
  console.log(`📉 Price Drop Groups: ${priceDropDuplicates.toLocaleString()}`);

  const sampleDuplicate = await Duplicate.findOne({ relistCount: { $gt: 1 } }).lean();
  if (sampleDuplicate) {
    console.log(`🔍 Sample Relisted Duplicate Group:`, {
      rootId: sampleDuplicate.rootId,
      name: sampleDuplicate.name,
      relistCount: sampleDuplicate.relistCount,
      firstPrice: sampleDuplicate.firstPrice,
      latestPrice: sampleDuplicate.latestPrice,
      priceDropPercent: sampleDuplicate.priceDropPercent,
      sourceIds: sampleDuplicate.sourceIds
    });
  }

  await mongoose.disconnect();
}

verifyLogic().catch(console.error);
