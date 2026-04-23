/**
 * Script dọn dẹp: Xóa sampleId cũ + collection AuctionSamples
 * Chạy 1 lần: node src/scripts/cleanupSamples.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');

async function run() {
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // 1. Drop AuctionSamples collection nếu tồn tại
  try {
    await db.dropCollection('auctionsamples');
    console.log('✅ Dropped auctionsamples collection');
  } catch (e) {
    console.log('ℹ️  auctionsamples collection not found (already clean)');
  }

  // 2. Xóa field sampleId khỏi AuctionNotice
  const r1 = await db.collection('auctionnotices').updateMany(
    { sampleId: { $exists: true } },
    { $unset: { sampleId: '' } }
  );
  console.log(`✅ Removed sampleId from ${r1.modifiedCount} AuctionNotice records`);

  // 3. Xóa field sampleId khỏi OrgSelection
  const r2 = await db.collection('orgselections').updateMany(
    { sampleId: { $exists: true } },
    { $unset: { sampleId: '' } }
  );
  console.log(`✅ Removed sampleId from ${r2.modifiedCount} OrgSelection records`);

  // 4. Reset detailScraped để re-crawl detail mới (có publishRound)
  const r3 = await db.collection('auctionnotices').updateMany(
    {},
    { $set: { detailScraped: false }, $unset: { publishRound: '', publishRoundLabel: '', rootId: '', relatedIds: '' } }
  );
  console.log(`✅ Reset ${r3.modifiedCount} AuctionNotice detailScraped to false`);

  await mongoose.disconnect();
  console.log('\n🏁 Cleanup done!');
}

run().catch(err => { console.error(err); process.exit(1); });
