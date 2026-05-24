const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');
  
  const targetIds = [566731, 241186, 268652, 466453, 566714];
  
  console.log('--- AUCTION NOTICES ---');
  const notices = await db.collection('auctionnotices')
    .find({ sourceId: { $in: targetIds } })
    .project({ sourceId: 1, name: 1, province: 1, relatedIds: 1, rootId: 1 })
    .toArray();
  
  for (const n of notices) {
    console.log(`SourceId: ${n.sourceId}`);
    console.log(`Name: "${n.name}"`);
    console.log(`Province: "${n.province}"`);
    console.log(`RelatedIds: ${JSON.stringify(n.relatedIds)}`);
    console.log(`RootId: ${n.rootId}`);
    console.log('---');
  }

  console.log('\n--- DUPLICATE GROUPS ---');
  const dups = await db.collection('duplicates')
    .find({ sourceIds: { $in: targetIds } })
    .toArray();
    
  for (const d of dups) {
    console.log(`Group ID: ${d._id}`);
    console.log(`Name: "${d.name}"`);
    console.log(`Type: ${d.type}`);
    console.log(`SourceIds: ${JSON.stringify(d.sourceIds)}`);
    console.log(`FirstPrice: ${d.firstPrice}, LatestPrice: ${d.latestPrice}`);
    console.log(`Province: ${d.province}, District: ${d.district}, Commune: ${d.commune}`);
    console.log('---');
  }
  
  client.close();
}

run().catch(console.error);
