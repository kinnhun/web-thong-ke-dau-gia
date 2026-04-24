/**
 * Main entry point: API server + Auto-crawl mỗi 15 phút
 * 
 * Logic mới (v2):
 *   - Mỗi 15 phút tự động cào data mới
 *   - Cào list → ngay lập tức cào detail cho item mới → nhóm sample
 *   - Gặp 20 bản cũ liên tiếp → dừng sớm
 *   - Không cần bước crawl detail riêng nữa
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
const config = require('./config');
const { refreshStats } = require('./services/stats.service');

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
    // Cào thông báo đấu giá (list + detail + sample, all-in-one)
    await crawlAuctionNotices({ isAuto: true });

    // Cào lựa chọn tổ chức (list + detail + sample, all-in-one)
    await crawlOrgSelections({ isAuto: true });

    // Cập nhật thống kê vào bảng tạm
    await refreshStats();

    // Đóng browser sau mỗi đợt để giải phóng RAM
    await closeBrowser();

    console.log(`\n✅ [${timeNow()}] Auto-crawl hoàn thành! Đợt sau: 5 phút nữa`);
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
  console.log('║   🤖 BOT CÀO DỮ LIỆU ĐẤU GIÁ v2                     ║');
  console.log('║   Nguồn: dgts.moj.gov.vn                               ║');
  console.log('║   Mode: List + Detail + Sample (all-in-one)             ║');
  console.log('║   Early-stop: Dừng khi gặp 20 bản cũ liên tiếp         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await connectDB();

  // Start API server
  const { createServer } = require('./api/server');
  const server = createServer();
  const PORT = config.api.port || 4000;
  server.listen(PORT, () => {
    console.log(`\n🌐 API server: http://localhost:${PORT}`);
    console.log(`   - GET /api/auctions           Danh sách đấu giá`);
    console.log(`   - GET /api/auctions/:id        Chi tiết`);
    console.log(`   - GET /api/org-selections      Lựa chọn tổ chức`);
    console.log(`   - GET /api/samples             Nhóm trùng tên`);
    console.log(`   - GET /api/samples/:id          Chi tiết nhóm`);
    console.log(`   - GET /api/auctions/stats       Thống kê`);
    console.log(`   - GET /api/crawl-logs           Lịch sử crawl`);
  });

  // Schedule auto-crawl mỗi 5 phút
  const schedule = process.env.CRON_SCHEDULE || '*/5 * * * *';
  cron.schedule(schedule, runAutoCrawl);
  console.log(`\n⏰ Auto-crawl schedule: ${schedule} (mỗi 5 phút)`);
  console.log(`🔄 Skip threshold: ${config.crawl.skipThreshold} bản cũ liên tiếp → dừng sớm`);

  // Chạy lần đầu sau 5 giây
  console.log(`\n🚀 Crawl lần đầu sau 5 giây...`);
  setTimeout(runAutoCrawl, 5000);

  // Tính toán stats ban đầu
  setTimeout(refreshStats, 2000);

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
