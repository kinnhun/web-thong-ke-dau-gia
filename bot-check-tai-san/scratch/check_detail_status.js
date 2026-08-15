const mongoose = require('mongoose');

async function checkDetails() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  
  const testIds = [1, 2, 50, 100, 200, 300, 400, 500, 526, 1000, 2500, 5000, 7500, 10000, 12700, 13759];
  
  const rawCount = await mongoose.connection.db.collection('raw_auction_ids').countDocuments({ sourceId: { $in: testIds } });
  const noticeCount = await mongoose.connection.db.collection('auctionnotices').countDocuments({ sourceId: { $in: testIds } });
  const assetCount = await mongoose.connection.db.collection('assetitems').countDocuments({ sourceId: { $in: testIds } });
  
  console.log('--- KẾT QUẢ KIỂM TRA MẪU CHI TIẾT ---');
  console.log('Danh sách ID kiểm tra mẫu:', testIds);
  console.log(`1. Chỉ mục Raw ID (raw_auction_ids): ${rawCount} / ${testIds.length}`);
  console.log(`2. Chi tiết Thông báo đấu giá (auctionnotices): ${noticeCount} / ${testIds.length}`);
  console.log(`3. Chi tiết Danh mục tài sản (assetitems): ${assetCount} / ${testIds.length}`);

  const sampleNotice = await mongoose.connection.db.collection('auctionnotices').findOne({ sourceId: 1 });
  if (sampleNotice) {
    console.log('\n📄 MẪU DỮ LIỆU CÀO CHI TIẾT ID #1 (auctionnotices):');
    console.log({
      sourceId: sampleNotice.sourceId,
      title: sampleNotice.name || sampleNotice.title || sampleNotice.assetName,
      startingPrice: sampleNotice.startingPrice || sampleNotice.price,
      seller: sampleNotice.owner || sampleNotice.seller,
      auctionOrg: sampleNotice.auctionOrg || sampleNotice.organizer,
      createdAt: sampleNotice.createdAt,
    });
  }

  await mongoose.disconnect();
}

checkDetails().catch(console.error);
