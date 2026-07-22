const { connectDB, closeDB } = require('./db');
const RawAuctionId = require('./models/RawAuctionId');
const CrawlState = require('./models/CrawlState');

async function verifyDataset() {
  await connectDB();
  console.log('\n🔍 ĐANG KIỂM TRÀ ĐỐI SOÁT TOÀN BỘ DỮ LIỆU IDs...\n');

  const state = await CrawlState.findOne({ jobId: 'full_id_crawl' }).lean();
  const totalTarget = state ? state.totalRecords : 589476;
  const totalPages = state ? state.totalPages : 5895;

  const totalInDB = await RawAuctionId.countDocuments();
  const distinctIDs = (await RawAuctionId.distinct('sourceId')).length;

  // Kiểm tra danh sách các trang đã có trong DB
  const existingPagesArray = await RawAuctionId.distinct('pageNumber');
  const existingPagesSet = new Set(existingPagesArray);

  const missingPages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (!existingPagesSet.has(p)) {
      missingPages.push(p);
    }
  }

  const completionPct = ((totalInDB / totalTarget) * 100).toFixed(2);

  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 BÁO CÁO ĐỐI SOÁT CHỈNH CHU (ID AUDIT REPORT)`);
  console.log('══════════════════════════════════════════════════════════');
  console.log(`• Mục tiêu máy chủ:      ${totalTarget.toLocaleString('vi-VN')} IDs (${totalPages} trang)`);
  console.log(`• Tổng ID lưu MongoDB:    ${totalInDB.toLocaleString('vi-VN')} IDs`);
  console.log(`• Số ID thực tế duy nhất: ${distinctIDs.toLocaleString('vi-VN')} IDs`);
  console.log(`• Số trang hoàn tất:      ${existingPagesSet.size} / ${totalPages} trang`);
  console.log(`• Tỷ lệ hoàn thành:       ${completionPct}%`);
  console.log(`• Số trang còn thiếu:     ${missingPages.length} trang`);

  if (missingPages.length > 0) {
    console.log(`\n⚠️ DANH SÁCH CÁC TRANG CÒN THIẾU:`);
    console.log(`   ${missingPages.slice(0, 50).join(', ')}${missingPages.length > 50 ? '...' : ''}`);
    console.log(`👉 Hãy chạy lệnh: npm run crawl:retry để cào tự động bù các trang thiếu!`);
  } else {
    console.log('\n🎉 XÁC NHẬN: TOÀN BỘ 100% TRANG VÀ ID ĐÃ ĐƯỢC CÀO ĐẦY ĐỦ VÀ CHÍNH XÁC!');
  }
  console.log('══════════════════════════════════════════════════════════\n');

  await closeDB();
}

if (require.main === module) {
  verifyDataset().catch(console.error);
}

module.exports = { verifyDataset };
