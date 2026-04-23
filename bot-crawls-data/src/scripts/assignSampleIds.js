/**
 * Script: Gán sampleId cho dữ liệu cũ đã có trong DB
 * 
 * Chạy 1 lần: node src/scripts/assignSampleIds.js
 * 
 * Logic:
 *   1. Tìm tất cả AuctionNotice chưa có sampleId
 *   2. Nhóm theo name → tạo/update AuctionSample
 *   3. Gán sampleId cho từng record
 *   4. Tương tự cho OrgSelection
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const AuctionSample = require('../models/AuctionSample');

async function run() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected to MongoDB');

  // ═══════════════════════════════════
  // AUCTION NOTICES
  // ═══════════════════════════════════
  console.log('\n📦 Xử lý AuctionNotice...');
  const auctions = await AuctionNotice.find({ sampleId: { $exists: false } }).lean();
  console.log(`  Tìm thấy ${auctions.length} records chưa có sampleId`);

  const auctionGroups = {};
  for (const a of auctions) {
    const name = a.name || '';
    if (!name) continue;
    if (!auctionGroups[name]) auctionGroups[name] = [];
    auctionGroups[name].push(a);
  }

  let processedA = 0;
  for (const [name, items] of Object.entries(auctionGroups)) {
    // Sort by publishedAt ascending (oldest first)
    items.sort((a, b) => (a.publishedAt || 0) - (b.publishedAt || 0));

    const firstPrice = items[0].initialPrice || items[0].currentPrice || 0;
    const lastItem = items[items.length - 1];
    const latestPrice = lastItem.initialPrice || lastItem.currentPrice || 0;

    const sampleItems = items.map(it => ({
      sourceId: it.sourceId,
      price: it.initialPrice || it.currentPrice || 0,
      publishedAt: it.publishedAt,
      sourceType: 'auction',
    }));

    // Upsert sample
    const sample = await AuctionSample.findOneAndUpdate(
      { name },
      {
        $set: {
          items: sampleItems,
          count: items.length,
          province: items[0].province || '',
          firstPrice,
          latestPrice,
          priceReduced: firstPrice > 0 && latestPrice < firstPrice,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Gán sampleId cho tất cả records trong nhóm
    const sourceIds = items.map(it => it.sourceId);
    await AuctionNotice.updateMany(
      { sourceId: { $in: sourceIds } },
      { $set: { sampleId: sample._id } }
    );

    processedA++;
    if (processedA % 500 === 0) {
      console.log(`  ✅ ${processedA}/${Object.keys(auctionGroups).length} nhóm`);
    }
  }

  const dupAuctions = Object.values(auctionGroups).filter(g => g.length > 1).length;
  console.log(`  ✅ Hoàn thành! ${Object.keys(auctionGroups).length} nhóm (${dupAuctions} nhóm trùng tên)`);

  // ═══════════════════════════════════
  // ORG SELECTIONS
  // ═══════════════════════════════════
  console.log('\n📦 Xử lý OrgSelection...');
  const orgs = await OrgSelection.find({ sampleId: { $exists: false } }).lean();
  console.log(`  Tìm thấy ${orgs.length} records chưa có sampleId`);

  const orgGroups = {};
  for (const o of orgs) {
    const name = o.name || '';
    if (!name) continue;
    if (!orgGroups[name]) orgGroups[name] = [];
    orgGroups[name].push(o);
  }

  let processedO = 0;
  for (const [name, items] of Object.entries(orgGroups)) {
    items.sort((a, b) => (a.publishedAt || 0) - (b.publishedAt || 0));

    const firstPrice = items[0].startingPrice || 0;
    const lastItem = items[items.length - 1];
    const latestPrice = lastItem.startingPrice || 0;

    const sampleItems = items.map(it => ({
      sourceId: it.sourceId,
      price: it.startingPrice || 0,
      publishedAt: it.publishedAt,
      sourceType: 'org',
    }));

    const sample = await AuctionSample.findOneAndUpdate(
      { name },
      {
        $set: {
          items: sampleItems,
          count: items.length,
          province: items[0].province || '',
          firstPrice,
          latestPrice,
          priceReduced: firstPrice > 0 && latestPrice < firstPrice,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const sourceIds = items.map(it => it.sourceId);
    await OrgSelection.updateMany(
      { sourceId: { $in: sourceIds } },
      { $set: { sampleId: sample._id } }
    );

    processedO++;
    if (processedO % 500 === 0) {
      console.log(`  ✅ ${processedO}/${Object.keys(orgGroups).length} nhóm`);
    }
  }

  const dupOrgs = Object.values(orgGroups).filter(g => g.length > 1).length;
  console.log(`  ✅ Hoàn thành! ${Object.keys(orgGroups).length} nhóm (${dupOrgs} nhóm trùng tên)`);

  // Summary
  const totalSamples = await AuctionSample.countDocuments();
  const totalDuplicates = await AuctionSample.countDocuments({ count: { $gt: 1 } });
  console.log(`\n═══════════════════════════════════`);
  console.log(`📊 TỔNG KẾT:`);
  console.log(`   Tổng samples: ${totalSamples}`);
  console.log(`   Nhóm trùng tên (>1 lần đăng): ${totalDuplicates}`);
  console.log(`═══════════════════════════════════`);

  await mongoose.disconnect();
  console.log('\n🔒 Disconnected');
}

run().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
