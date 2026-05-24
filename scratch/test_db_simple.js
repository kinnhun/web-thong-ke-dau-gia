const { MongoClient } = require('mongodb');

async function test() {
  console.log('Connecting to raw MongoDB...');
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  console.log('✅ Connected!');

  const db = client.db('thong_ke_dau_gia');
  console.log('Listing collections...');
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections);

  console.log('Inserting test doc...');
  const res = await db.collection('test').insertOne({ hello: 'world' });
  console.log('Insert result:', res);

  console.log('Finding test doc...');
  const doc = await db.collection('test').findOne({});
  console.log('Found doc:', doc);

  console.log('Deleting test doc...');
  await db.collection('test').deleteMany({});
  console.log('Deleted!');

  await client.close();
  console.log('Connection closed.');
}

test().catch(console.error);
