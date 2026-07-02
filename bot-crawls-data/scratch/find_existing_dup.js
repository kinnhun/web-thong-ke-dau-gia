const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  const ids = [531787, 349164, 471423, 469765];
  
  for (const id of ids) {
    const dup = await db.collection('duplicates').findOne({ sourceIds: id });
    if (dup) {
      console.log(`ID ${id} is in Duplicate Group ${dup._id}:`, dup.sourceIds);
    } else {
      console.log(`ID ${id} is NOT in any duplicate group.`);
    }
  }

  client.close();
}

run().catch(console.error);
