const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const OrgSelection = require('../src/models/OrgSelection');

async function run() {
  await connectDB();

  console.log('Checking AuctionNotice duplicates...');
  const dupAuctions = await AuctionNotice.aggregate([
    { $group: { _id: '$sourceId', count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 }
  ]);
  console.log('AuctionNotice Duplicates (sample):', dupAuctions);

  console.log('Checking OrgSelection duplicates...');
  const dupOrgs = await OrgSelection.aggregate([
    { $group: { _id: '$sourceId', count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 }
  ]);
  console.log('OrgSelection Duplicates (sample):', dupOrgs);

  console.log('Checking a specific sourceId 87339:');
  const notices = await AuctionNotice.find({ sourceId: 87339 }).lean();
  console.log('Notices with sourceId 87339:', notices.length, notices.map(n => ({ _id: n._id, name: n.name })));

  await closeDB();
}

run().catch(console.error);
