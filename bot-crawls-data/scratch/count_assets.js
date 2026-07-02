const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');

async function run() {
  await connectDB();

  const count = await AssetItem.countDocuments({});
  console.log(`Current AssetItem count in Database: ${count}`);

  await closeDB();
}

run().catch(console.error);
