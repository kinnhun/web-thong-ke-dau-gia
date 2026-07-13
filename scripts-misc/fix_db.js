const { MongoClient } = require('mongodb');
async function run() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('daugia');
  
  const id1 = 494836;
  const id2 = 212893;
  
  let items = await db.collection('auctionnotices').find({sourceId: {$in: [id1, id2]}}).project({sourceId: 1, relatedIds: 1}).toArray();
  console.log("Before (Number):", items);

  if (items.length === 0) {
    items = await db.collection('auctionnotices').find({sourceId: {$in: [String(id1), String(id2)]}}).project({sourceId: 1, relatedIds: 1}).toArray();
    console.log("Before (String):", items);
  }
  
  // Xóa liên kết chéo
  await db.collection('auctionnotices').updateMany({sourceId: id1}, {$pull: {relatedIds: id2}});
  await db.collection('auctionnotices').updateMany({sourceId: id2}, {$pull: {relatedIds: id1}});
  
  await db.collection('auctionnotices').updateMany({sourceId: String(id1)}, {$pull: {relatedIds: String(id2)}});
  await db.collection('auctionnotices').updateMany({sourceId: String(id2)}, {$pull: {relatedIds: String(id1)}});
  
  // Mở rộng pull mixed
  await db.collection('auctionnotices').updateMany({sourceId: id1}, {$pull: {relatedIds: String(id2)}});
  await db.collection('auctionnotices').updateMany({sourceId: String(id1)}, {$pull: {relatedIds: id2}});
  
  console.log('Fixed relatedIds');
  await client.close();
}
run();
