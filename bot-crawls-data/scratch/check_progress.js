const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');
  
  // Tổng số lượng
  const totalNotices = await db.collection('auctionnotices').countDocuments();
  const totalDuplicates = await db.collection('duplicates').countDocuments();
  
  // Số lượng cào mới từ lúc 17:13 (10:13 UTC)
  const startTime = new Date();
  startTime.setHours(17, 13, 0, 0); // 17:13 chiều nay
  
  const newNotices = await db.collection('auctionnotices').countDocuments({
    createdAt: { $gte: startTime }
  });
  
  const newDuplicates = await db.collection('duplicates').countDocuments({
    createdAt: { $gte: startTime }
  });
  
  // Trạng thái các logs chạy gần đây
  const runningLogs = await db.collection('crawllogs').find({
    status: { $in: ['running', 'completed', 'early_stopped'] }
  }).sort({ createdAt: -1 }).limit(3).toArray();

  console.log('\n=========================================');
  console.log('📊 THÔNG TIN TIẾN TRÌNH DATABASE:');
  console.log(`- Tổng số đấu giá (AuctionNotice): ${totalNotices}`);
  console.log(`- Tổng số nhóm gộp (Duplicate): ${totalDuplicates}`);
  console.log(`- Số đấu giá mới cào thêm từ 17:13: ${newNotices}`);
  console.log(`- Số nhóm gộp mới tạo từ 17:13: ${newDuplicates}`);
  console.log('=========================================');
  
  if (runningLogs.length > 0) {
    console.log('\n📝 LOGS CRAWL GẦN ĐÂY NHẤT:');
    runningLogs.forEach(log => {
      console.log(`- Loại: ${log.type} | Trạng thái: ${log.status} | Đã xong: ${log.pagesProcessed || 0}/${log.totalPages || 0} trang | Đã thêm: ${log.itemsInserted || 0} bản ghi | Bắt đầu lúc: ${log.startedAt}`);
    });
  }
  
  console.log('=========================================\n');
  
  client.close();
}

run().catch(console.error);
