const mongoose = require('mongoose');
const config = require('../src/config');
const AuctionNotice = require('../src/models/AuctionNotice');

async function testCreate() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected DB');

  const testId = 99999999;
  await AuctionNotice.deleteOne({ sourceId: testId });

  try {
    const doc = await AuctionNotice.create({
      sourceId: testId,
      name: 'Test Notice Creation',
      publishedAt: new Date(),
    });
    console.log('✅ Created document successfully:', doc._id, doc.sourceId, doc.publishedAt);
    await AuctionNotice.deleteOne({ _id: doc._id });
  } catch (err) {
    console.error('❌ Error creating document:', err);
  }

  await mongoose.disconnect();
}

testCreate().catch(console.error);
