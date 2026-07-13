const { MongoClient } = require('mongodb');
async function run() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('thong_ke_dau_gia');
  
  const i1 = await db.collection('auctionnotices').findOne({sourceId: 494836});
  const i2 = await db.collection('auctionnotices').findOne({sourceId: 212893});
  
  console.log("i1 rootId:", i1?.rootId);
  console.log("i2 rootId:", i2?.rootId);
  
  await client.close();
}
run();
