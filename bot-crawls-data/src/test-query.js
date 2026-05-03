const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('thong_ke_dau_gia');
  
  console.time('find_text_score_sort');
  const res = await db.collection('auctionnotices').find({ $text: { $search: '"bản" "đồ" "số" "3" "tại" "phường" "an"' } })
    .project({ score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" } })
    .limit(20)
    .toArray();
  console.timeEnd('find_text_score_sort');
  console.log('find_text_score_sort count:', res.length);
  
  console.time('count_text');
  const c = await db.collection('auctionnotices').countDocuments({ $text: { $search: '"bản" "đồ" "số" "3" "tại" "phường" "an"' } });
  console.timeEnd('count_text');
  console.log('count_text:', c);
  
  client.close();
})();
