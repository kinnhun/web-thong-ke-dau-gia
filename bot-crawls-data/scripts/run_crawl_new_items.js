const { connectDB, closeDB } = require('../src/db');
const { closeBrowser } = require('../src/browser');
const { crawlAuctionNotices } = require('../src/scrapers/auctionNotice.scraper');
const { refreshStats } = require('../src/services/stats.service');

async function runCrawlNewItems() {
  console.log('🚀 Bắt đầu cào tất cả thông báo mới từ ngày 6/8 đến 15/8...');
  await connectDB();

  try {
    const stats = await crawlAuctionNotices({
      startPage: 1,
      maxPages: 100, // Cào tối đa 100 trang để phủ toàn bộ từ ngày 6/8 đến nay
      isAuto: true,  // Gặp 20 bản ghi cũ liên tiếp mới dừng
    });

    console.log('\n📊 KẾT QUẢ CÀO:');
    console.log(`- Đã thêm mới: ${stats.inserted} bài đăng`);
    console.log(`- Đã bỏ qua: ${stats.skipped} bài đăng cũ`);
    console.log(`- Lỗi: ${stats.errors} bài đăng`);

    await refreshStats();
  } catch (err) {
    console.error('❌ Lỗi cào:', err);
  } finally {
    await closeBrowser();
    await closeDB();
    process.exit(0);
  }
}

runCrawlNewItems();
