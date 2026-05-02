const { MongoClient } = require('mongodb');
async function run() {
  const c = await MongoClient.connect('mongodb://localhost:27017');
  const db = c.db('thong_ke_dau_gia');
  const items = await db.collection('auctionnotices').find({sourceId: {$in: [465311, 499888]}}).project({sourceId: 1, relatedIds: 1, rootId: 1, name: 1}).toArray();
  console.log(items);
  c.close();
}
run();
