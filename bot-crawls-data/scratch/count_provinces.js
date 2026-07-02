const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');

async function run() {
  await connectDB();

  console.log('--- AssetItem Count by Province ---');
  const counts = await AssetItem.aggregate([
    { $group: { _id: "$province", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  let total = 0;
  counts.forEach(c => {
    console.log(`${c._id || 'UNKNOWN'}: ${c.count}`);
    total += c.count;
  });
  console.log('----------------------------------');
  console.log(`Total AssetItems: ${total}`);

  await closeDB();
}

run().catch(console.error);
