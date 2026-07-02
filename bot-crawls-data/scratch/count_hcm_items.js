const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');

async function run() {
  await connectDB();

  const count = await AssetItem.countDocuments({ sourceType: 'auction', province: 'TP. Hồ Chí Minh' });
  console.log(`TP. Hồ Chí Minh AssetItem count: ${count}`);

  const sample = await AssetItem.find({ sourceType: 'auction', province: 'TP. Hồ Chí Minh' }).limit(5).lean();
  console.log('Sample items:', JSON.stringify(sample, null, 2));

  await closeDB();
}

run().catch(console.error);
