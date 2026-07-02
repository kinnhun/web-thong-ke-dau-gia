const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  const ids = [531787, 532768, 471423, 469765, 349164];
  const notices = await db.collection('auctionnotices')
    .find({ sourceId: { $in: ids } })
    .toArray();

  notices.forEach(n => {
    console.log(`\n--------------------------------------------`);
    console.log(`ID: ${n.sourceId}`);
    console.log(`Name: ${n.name}`);
    console.log(`Province: ${n.province}`);
    console.log(`Organizer: ${n.organizer}`);
    console.log(`Detail Scraped: ${n.detailScraped}`);
    console.log(`Related IDs (from notice):`, n.relatedIds);
    console.log(`Root ID:`, n.rootId);
  });

  client.close();
}

run().catch(console.error);
