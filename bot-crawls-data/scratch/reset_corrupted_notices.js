const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const OrgSelection = require('../src/models/OrgSelection');
const config = require('../src/config');

async function reset() {
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB.');

  const isMissingString = (field) => ([
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: '' },
  ]);

  const isMissingNumber = (field) => ([
    { [field]: { $exists: false } },
    { [field]: null },
    { [field]: 0 },
  ]);

  const missingAuctionQuery = {
    detailScraped: true,
    $or: [
      { properties: { $exists: false } },
      { properties: { $size: 0 } },
      ...isMissingNumber('initialPrice'),
      ...isMissingString('name'),
      ...isMissingString('province'),
      ...isMissingString('organizer'),
    ]
  };

  const missingOrgQuery = {
    detailScraped: true,
    $or: [
      { properties: { $exists: false } },
      { properties: { $size: 0 } },
      ...isMissingNumber('startingPrice'),
      ...isMissingString('name'),
      ...isMissingString('province'),
    ]
  };

  const badAuctionsCount = await AuctionNotice.countDocuments(missingAuctionQuery);
  const badOrgsCount = await OrgSelection.countDocuments(missingOrgQuery);

  console.log(`Found ${badAuctionsCount} corrupted AuctionNotices (detailScraped: true but missing critical details)`);
  console.log(`Found ${badOrgsCount} corrupted OrgSelections (detailScraped: true but missing critical details)`);

  if (badAuctionsCount > 0) {
    console.log(`Resetting detailScraped to false for ${badAuctionsCount} corrupted AuctionNotices...`);
    const res = await AuctionNotice.updateMany(missingAuctionQuery, { 
      $set: { detailScraped: false },
      $inc: { zeroPriceRetryCount: 1 } 
    });
    console.log(`Reset result: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  if (badOrgsCount > 0) {
    console.log(`Resetting detailScraped to false for ${badOrgsCount} corrupted OrgSelections...`);
    const res = await OrgSelection.updateMany(missingOrgQuery, { 
      $set: { detailScraped: false },
      $inc: { zeroPriceRetryCount: 1 }
    });
    console.log(`Reset result: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

reset().catch(console.error);
