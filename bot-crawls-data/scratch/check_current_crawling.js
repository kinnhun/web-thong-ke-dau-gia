const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  console.log('🔍 Lấy danh sách 5 bản ghi đấu giá mới nhất...');
  
  const notices = await db.collection('auctionnotices')
    .find()
    .sort({ createdAt: -1 })
    .limit(5)
    .project({ sourceId: 1, name: 1, createdAt: 1 })
    .toArray();
    
  notices.forEach((n, idx) => {
    console.log(`[${idx + 1}] ID: ${n.sourceId} | Tên: ${n.name?.substring(0, 40)}... | Tạo lúc: ${n.createdAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  });

  client.close();
}

run().catch(console.error);
