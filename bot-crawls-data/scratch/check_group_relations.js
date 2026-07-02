const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const Duplicate = require('../src/models/Duplicate');
const PotentialDuplicate = require('../src/models/PotentialDuplicate');

async function run() {
  await connectDB();

  const ids = [454852, 471403, 561763];

  console.log('--- Checking in Duplicates collection ---');
  const dups = await Duplicate.find({
    $or: [
      { 'items.sourceId': { $in: ids } },
      { masterId: { $in: ids } }
    ]
  }).lean();
  console.log(JSON.stringify(dups, null, 2));

  console.log('--- Checking in PotentialDuplicates collection ---');
  const potentials = await PotentialDuplicate.find({
    $or: [
      { 'itemA.sourceId': { $in: ids } },
      { 'itemB.sourceId': { $in: ids } }
    ]
  }).lean();
  console.log(JSON.stringify(potentials, null, 2));

  await closeDB();
}

run().catch(console.error);
