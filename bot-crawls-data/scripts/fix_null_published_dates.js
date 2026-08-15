const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const { parseDate } = require('../src/utils/helpers');
const { extractAssetItemsFromNotice, mergeIdenticalAssetGroups, rebuildAllDuplicateEntries } = require('../src/scrapers/detail.scraper');

async function fixNullDatesAndSyncDuplicates() {
  console.log('🚀 Đang kết nối CSDL để kiểm tra và sửa ngày xuất bản (publishedAt) bị null...');
  await connectDB();

  try {
    // 1. Tìm tất cả các bản ghi AuctionNotice có publishedAt bị null hoặc invalid
    const nullNotices = await AuctionNotice.find({
      $or: [
        { publishedAt: { $eq: null } },
        { publishedAt: { $exists: false } }
      ]
    }).lean();

    console.log(`🔍 Tìm thấy ${nullNotices.length} bài đăng bị khuyết/null ngày xuất bản (publishedAt).`);

    let updatedCount = 0;
    for (const doc of nullNotices) {
      let resolvedDate = parseDate(doc.publishedAt)
        || parseDate(doc.publishTime1)
        || parseDate(doc.publishTime2)
        || parseDate(doc.publishTime)
        || parseDate(doc.createdDate)
        || parseDate(doc.lastUpdated)
        || parseDate(doc.aucRegTimeStart)
        || parseDate(doc.aucTime)
        || doc.createdAt
        || doc.updatedAt;

      if (resolvedDate && !isNaN(new Date(resolvedDate).getTime())) {
        await AuctionNotice.updateOne({ _id: doc._id }, { $set: { publishedAt: new Date(resolvedDate) } });
        updatedCount++;
      }
    }

    console.log(`✅ Đã bổ sung ngày xuất bản (publishedAt) cho ${updatedCount}/${nullNotices.length} bài đăng.`);

    // 2. Dùng Cursor streaming để trích xuất AssetItem (tránh tràn RAM Heap)
    console.log(`\n📦 Đang kiểm tra AssetItem của tất cả bài đăng (Cursor streaming)...`);
    const cursor = AuctionNotice.find({}).lean().cursor();
    let assetItemCount = 0;
    let batchOps = [];

    for await (const doc of cursor) {
      const items = extractAssetItemsFromNotice(doc, 'auction');
      items.forEach(item => {
        batchOps.push({
          updateOne: {
            filter: { sourceType: 'auction', sourceId: item.sourceId, itemIndex: item.itemIndex },
            update: { $set: item },
            upsert: true
          }
        });
      });

      if (batchOps.length >= 1000) {
        assetItemCount += batchOps.length;
        await AssetItem.bulkWrite(batchOps, { ordered: false }).catch(() => {});
        batchOps = [];
      }
    }

    if (batchOps.length > 0) {
      assetItemCount += batchOps.length;
      await AssetItem.bulkWrite(batchOps, { ordered: false }).catch(() => {});
    }

    console.log(`✅ Đã đồng bộ ${assetItemCount} AssetItem vào DB.`);

    // 3. Tái cấu trúc lại Duplicate groups & Relisting metrics
    console.log(`\n🔄 Đang chạy Cross-Group Merge & Rebuild Duplicate...`);
    await mergeIdenticalAssetGroups('auction');
    await rebuildAllDuplicateEntries(null, null, { type: 'auction' });

    console.log(`\n✨ Hoàn tất sửa ngày xuất bản & đồng bộ duplicate!`);
  } catch (err) {
    console.error('❌ Lỗi trong quá trình sửa dữ liệu:', err);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

fixNullDatesAndSyncDuplicates();
