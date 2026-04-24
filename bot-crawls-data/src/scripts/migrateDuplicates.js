/**
 * Script: Migrate Duplicate records to new schema
 * 
 * Chạy 1 lần: node src/scripts/migrateDuplicates.js
 * 
 * Logic:
 *   1. Tìm tất cả Duplicate records hiện có
 *   2. Nạp giá + ngày đăng từ AuctionNotice / OrgSelection
 *   3. Build entries chi tiết
 *   4. Tính toán firstPrice, latestPrice, isPriceDrop, priceDropPercent
 *   5. Lưu lại
 */
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const Duplicate = require('../models/Duplicate');

async function run() {
  await mongoose.connect(config.mongo.uri);
  console.log('✅ Connected to MongoDB');

  const duplicates = await Duplicate.find({});
  console.log(`\n📦 Tìm thấy ${duplicates.length} nhóm Duplicate cần migrate`);

  let updatedCount = 0;
  let priceDropCount = 0;

  for (const dup of duplicates) {
    if (!dup.sourceIds || dup.sourceIds.length === 0) continue;

    const Model = dup.type === 'org' ? OrgSelection : AuctionNotice;
    const priceField = dup.type === 'org' ? 'startingPrice' : 'initialPrice';

    const items = await Model.find({ sourceId: { $in: dup.sourceIds } })
      .select(`sourceId ${priceField} currentPrice publishedAt publishRound publishRoundLabel rootId sourceUrl`)
      .sort({ sourceId: 1 })
      .lean();

    // Build entries
    const entries = items.map((item, idx) => ({
      sourceId: item.sourceId,
      price: item[priceField] || item.currentPrice || 0,
      publishedAt: item.publishedAt,
      publishRound: item.publishRound || idx + 1,
      publishRoundLabel: item.publishRoundLabel || '',
      rootId: item.rootId || null,
      sourceUrl: item.sourceUrl || '',
    }));

    // Thêm missing IDs
    const foundIds = items.map(i => i.sourceId);
    const missingIds = dup.sourceIds.filter(id => !foundIds.includes(id));
    for (const id of missingIds) {
      entries.push({
        sourceId: id,
        price: 0,
        publishedAt: null,
        publishRound: 0,
        publishRoundLabel: '',
        rootId: null,
        sourceUrl: '',
      });
    }

    entries.sort((a, b) => a.sourceId - b.sourceId);

    // Update dup
    dup.entries = entries;
    dup.relistCount = entries.length;

    const pricesWithValues = entries.filter(e => e.price && e.price > 0);
    if (pricesWithValues.length > 0) {
      dup.firstPrice = pricesWithValues[0].price;
      dup.latestPrice = pricesWithValues[pricesWithValues.length - 1].price;

      const minPrice = Math.min(...pricesWithValues.map(e => e.price));
      const hasAnyDrop = pricesWithValues.some(e => e.price < dup.firstPrice);
      const uniquePrices = [...new Set(pricesWithValues.map(e => e.price))];

      if (hasAnyDrop || uniquePrices.length > 1) {
        dup.isPriceDrop = true;
        dup.priceDropPercent = Math.round((1 - minPrice / dup.firstPrice) * 10000) / 100;
        priceDropCount++;
      } else {
        dup.isPriceDrop = false;
        dup.priceDropPercent = 0;
      }
    }

    const entryWithRoot = entries.find(e => e.rootId);
    if (entryWithRoot) dup.rootId = entryWithRoot.rootId;

    await dup.save();
    updatedCount++;

    if (updatedCount % 50 === 0) {
      console.log(`  ✅ ${updatedCount}/${duplicates.length} nhóm | ${priceDropCount} giảm giá`);
    }
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`📊 KẾT QUẢ MIGRATION:`);
  console.log(`   Tổng nhóm Duplicate: ${duplicates.length}`);
  console.log(`   Đã cập nhật: ${updatedCount}`);
  console.log(`   Có giảm giá: ${priceDropCount}`);
  console.log(`═══════════════════════════════════`);

  await mongoose.disconnect();
  console.log('\n🔒 Disconnected');
}

run().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
