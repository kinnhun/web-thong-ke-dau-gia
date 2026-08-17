/**
 * Script cào bù & sửa dữ liệu lịch sử bị thiếu chi tiết trong DB
 * Chạy: node src/scripts/repair_missing_details.js
 * Hoặc: node src/scripts/repair_missing_details.js --limit=50
 */
const { connectDB, closeDB } = require('../db');
const { closeBrowser } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const { fetchAuctionItemDetail, fetchOrgItemDetail } = require('../scrapers/detail.scraper');
const { delay } = require('../utils/helpers');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    args[key] = val || true;
  });
  return args;
}

async function repairAuctions(limit = 0) {
  console.log('\n🔍 [1/2] Đang tìm các Thông Báo Đấu Giá bị thiếu chi tiết...');
  
  const query = {
    $or: [
      { detailScraped: { $ne: true } },
      { initialPrice: { $exists: false } },
      { initialPrice: null },
      { name: { $exists: false } },
      { name: '' },
      { name: null }
    ]
  };

  let q = AuctionNotice.find(query).sort({ _id: -1 });
  if (limit > 0) q = q.limit(limit);
  const targets = await q.lean();

  console.log(`📋 Phát hiện ${targets.length} bài AuctionNotice chưa hoàn chỉnh chi tiết.`);
  if (targets.length === 0) return { fixed: 0, failed: 0 };

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    console.log(`[Auction ${i + 1}/${targets.length}] ID=${item.sourceId}...`);
    try {
      const { updates, files } = await fetchAuctionItemDetail(item.sourceId, item.name);
      updates.detailScraped = true;
      updates.lastCrawledAt = new Date();
      if (files && files.length > 0) updates.files = files;

      await AuctionNotice.updateOne({ _id: item._id }, { $set: updates });
      fixed++;
      console.log(`  ✅ ID=${item.sourceId}: Name="${(updates.name || item.name || '').substring(0, 50)}", Price=${updates.initialPrice || 'N/A'}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ ID=${item.sourceId} lỗi: ${err.message}`);
    }
    await delay(1500 + Math.random() * 1000);
  }

  console.log(`📊 Hoàn thành AuctionNotice: Fixed ${fixed}/${targets.length}, Failed ${failed}`);
  return { fixed, failed };
}

async function repairOrgs(limit = 0) {
  console.log('\n🔍 [2/2] Đang tìm các Lựa Chọn Tổ Chức bị thiếu chi tiết...');
  
  const query = {
    $or: [
      { detailScraped: { $ne: true } },
      { startingPrice: { $exists: false } },
      { startingPrice: null },
      { name: { $exists: false } },
      { name: '' },
      { name: null }
    ]
  };

  let q = OrgSelection.find(query).sort({ _id: -1 });
  if (limit > 0) q = q.limit(limit);
  const targets = await q.lean();

  console.log(`📋 Phát hiện ${targets.length} bài OrgSelection chưa hoàn chỉnh chi tiết.`);
  if (targets.length === 0) return { fixed: 0, failed: 0 };

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    console.log(`[Org ${i + 1}/${targets.length}] ID=${item.sourceId}...`);
    try {
      const { updates, files } = await fetchOrgItemDetail(item.sourceId);
      updates.detailScraped = true;
      updates.lastCrawledAt = new Date();
      if (files && files.length > 0) updates.files = files;

      await OrgSelection.updateOne({ _id: item._id }, { $set: updates });
      fixed++;
      console.log(`  ✅ ID=${item.sourceId}: Name="${(updates.name || item.name || '').substring(0, 50)}", Price=${updates.startingPrice || 'N/A'}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ ID=${item.sourceId} lỗi: ${err.message}`);
    }
    await delay(1500 + Math.random() * 1000);
  }

  console.log(`📊 Hoàn thành OrgSelection: Fixed ${fixed}/${targets.length}, Failed ${failed}`);
  return { fixed, failed };
}

async function main() {
  const args = parseArgs();
  const limit = args.limit ? parseInt(args.limit, 10) : 0;

  console.log('==================================================');
  console.log('🛠️ SCRIPT CÀO BÙ & SỬA DỮ LIỆU THIẾU CHI TIẾT');
  console.log('==================================================');

  await connectDB();

  try {
    const resAuc = await repairAuctions(limit);
    const resOrg = await repairOrgs(limit);

    console.log('\n==================================================');
    console.log('🎉 TÓM TẮT KẾT QUẢ CÀO BÙ:');
    console.log(`- AuctionNotice: Fixed ${resAuc.fixed}, Failed ${resAuc.failed}`);
    console.log(`- OrgSelection: Fixed ${resOrg.fixed}, Failed ${resOrg.failed}`);
    console.log('==================================================\n');
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await closeBrowser();
    await closeDB();
    process.exit(0);
  }
}

main();
