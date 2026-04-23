/**
 * Main entry point: API server + Auto-crawl mỗi 15 phút
 * 
 * Logic:
 *   - Mỗi 15 phút tự động cào data mới
 *   - Data mới → lưu, data cũ → bỏ qua
 *   - Gặp 20 bản cũ liên tiếp → dừng sớm (không có data mới nữa)
 *   - Đợi 15 phút → cào tiếp
 * 
 * Chạy:
 *   node src/index.js       # API server + auto-crawl
 *   node src/crawler.js     # Chạy crawl thủ công
 */
require('dotenv').config();
const cron = require('node-cron');
const { connectDB } = require('./db');
const { closeBrowser } = require('./browser');
const { crawlAuctionNotices } = require('./scrapers/auctionNotice.scraper');
const { crawlOrgSelections } = require('./scrapers/orgSelection.scraper');
const { crawlDetails, crawlOrgDetails } = require('./scrapers/detail.scraper');
const config = require('./config');

let isCrawling = false; // Tránh chạy chồng lấn

async function runAutoCrawl() {
  if (isCrawling) {
    console.log(`⏭️  [${timeNow()}] Bỏ qua - đợt trước vẫn đang chạy`);
    return;
  }

  isCrawling = true;
  console.log('\n' + '═'.repeat(60));
  console.log(`🕐 [${timeNow()}] Bắt đầu auto-crawl...`);
  console.log('═'.repeat(60));

  try {
    // Cào thông báo đấu giá (không giới hạn trang, dùng early-stop)
    await crawlAuctionNotices();

    // Cào lựa chọn tổ chức (không giới hạn trang, dùng early-stop)
    await crawlOrgSelections();

    // Cào chi tiết (top 30 chưa cào mỗi đợt)
    await crawlDetails({ maxItems: 30 });
    
    // Cào chi tiết tổ chức đấu giá (top 30)
    await crawlOrgDetails({ maxItems: 30 });

    // Đóng browser sau mỗi đợt để giải phóng RAM
    await closeBrowser();

    console.log(`\n✅ [${timeNow()}] Auto-crawl hoàn thành! Đợt sau: 15 phút nữa`);
  } catch (err) {
    console.error(`\n❌ Auto-crawl lỗi: ${err.message}`);
    await closeBrowser();
  }

  isCrawling = false;
}

function timeNow() {
  return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   🤖 BOT CÀO DỮ LIỆU ĐẤU GIÁ                         ║');
  console.log('║   Nguồn: dgts.moj.gov.vn                               ║');
  console.log('║   Mode: Auto-crawl mỗi 15 phút + API Server            ║');
  console.log('║   Early-stop: Dừng khi gặp 20 bản cũ liên tiếp         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await connectDB();

  // Start API server
  const { createServer } = require('./api/server');
  const server = createServer();
  const PORT = config.api.port || 4000;
  server.listen(PORT, () => {
    console.log(`\n🌐 API server: http://localhost:${PORT}`);
    console.log(`   - GET /api/auctions          Danh sách đấu giá`);
    console.log(`   - GET /api/auctions/:id       Chi tiết`);
    console.log(`   - GET /api/org-selections     Lựa chọn tổ chức`);
    console.log(`   - GET /api/stats              Thống kê`);
    console.log(`   - GET /api/crawl-logs         Lịch sử crawl`);
  });

  // Schedule auto-crawl mỗi 15 phút
  const schedule = config.cron;
  cron.schedule(schedule, runAutoCrawl);
  console.log(`\n⏰ Auto-crawl schedule: ${schedule} (mỗi 15 phút)`);
  console.log(`🔄 Skip threshold: ${config.crawl.skipThreshold} bản cũ liên tiếp → dừng sớm`);

  // Chạy lần đầu sau 5 giây
  console.log(`\n🚀 Crawl lần đầu sau 5 giây...`);
  setTimeout(runAutoCrawl, 5000);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Đang shutdown...');
    await closeBrowser();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await closeBrowser();
    process.exit(0);
  });
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await closeBrowser();
  process.exit(1);
});
