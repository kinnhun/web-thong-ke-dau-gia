const { connectDB, closeDB } = require('../src/db');
const { closeBrowser } = require('../src/browser');
const { crawlAuctionNotices } = require('../src/scrapers/auctionNotice.scraper');
const { refreshStats } = require('../src/services/stats.service');
const AuctionNotice = require('../src/models/AuctionNotice');

async function runCrawlAug12Notices() {
  console.log('🚀 Bắt đầu cào tất cả 541+ bài đăng của ngày 12/08/2026 vào CSDL...');
  await connectDB();

  try {
    const stats = await crawlAuctionNotices({
      startPage: 1,
      maxPages: 30,  // Cào 30 trang tương đương 3,000 bài để phủ toàn bộ ngày 12/08 và các ngày lân cận
      isAuto: false, // isAuto=false để cào phủ liên tục không ngắt đếm bài cũ giữa chừng
    });

    console.log('\n📊 KẾT QUẢ CÀO:');
    console.log(`- Đã thêm mới: ${stats.inserted} bài đăng`);
    console.log(`- Bỏ qua (trùng ID): ${stats.skipped} bài đăng`);
    console.log(`- Lỗi: ${stats.errors} bài đăng`);

    // Đếm số lượng bài của ngày 12/08/2026 trong DB
    const startLocal = new Date('2026-08-12T00:00:00+07:00');
    const endLocal = new Date('2026-08-12T23:59:59.999+07:00');

    const aug12Count = await AuctionNotice.countDocuments({
      publishedAt: { $gte: startLocal, $lte: endLocal }
    });

    console.log(`\n🎉 TỔNG SỐ BÀI ĐĂNG NGÀY 12/08/2026 TRONG DB SAU KHI CÀO: ${aug12Count} bản ghi!`);

    await refreshStats();
  } catch (err) {
    console.error('❌ Lỗi cào:', err);
  } finally {
    await closeBrowser();
    await closeDB();
    process.exit(0);
  }
}

runCrawlAug12Notices();
