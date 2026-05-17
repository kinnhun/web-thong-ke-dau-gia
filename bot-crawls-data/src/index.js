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
const { connectDB, closeDB } = require('./db');
const { closeBrowser } = require('./browser');
const { crawlAuctionNotices } = require('./scrapers/auctionNotice.scraper');
const { crawlOrgSelections } = require('./scrapers/orgSelection.scraper');
const config = require('./config');
const { refreshStats } = require('./services/stats.service');
const CrawlLog = require('./models/CrawlLog');

let isCrawling = false; // Tránh chạy chồng lấn

async function runAutoCrawl() {
  if (isCrawling) {
    console.log(`⏭️  [${timeNow()}] Bỏ qua - đợt trước vẫn đang chạy`);
    return;
  }

  const runningHeavyLog = await CrawlLog.findOne({
    status: 'running',
    type: { $in: ['mega_detail_crawl', 'duplicate_scan', 'recrawl_missing_properties'] },
  }).sort({ createdAt: -1 }).lean();

  if (runningHeavyLog) {
    console.log(`⏭️  [${timeNow()}] Bỏ qua auto-crawl - đang chạy job nặng ${runningHeavyLog.type}`);
    return;
  }

  isCrawling = true;
  console.log('\n' + '═'.repeat(60));
  console.log(`🕐 [${timeNow()}] Bắt đầu auto-crawl...`);
  console.log('═'.repeat(60));

  try {
    // Cào thông báo đấu giá (list + detail + sample, all-in-one)
    // ★ Chạy song song 2 loại crawl thay vì tuần tự
    await Promise.all([
      crawlAuctionNotices({ isAuto: true }),
      crawlOrgSelections({ isAuto: true })
    ]);

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
  const serverInstance = server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 API server: http://0.0.0.0:${PORT} (mapped to 127.0.0.1 for proxy)`);

    console.log(`   - GET /api/auctions           Danh sách đấu giá`);
    console.log(`   - GET /api/auctions/:id        Chi tiết`);
    console.log(`   - GET /api/org-selections      Lựa chọn tổ chức`);
    console.log(`   - GET /api/samples             Nhóm trùng tên`);
    console.log(`   - GET /api/samples/:id          Chi tiết nhóm`);
    console.log(`   - GET /api/auctions/stats       Thống kê`);
    console.log(`   - GET /api/crawl-logs           Lịch sử crawl`);
  });

  // Tối ưu server timeouts để tránh ECONNRESET / socket hang up khi job nặng chạy
  serverInstance.keepAliveTimeout = 65000;
  serverInstance.headersTimeout = 66000;


  serverInstance.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ LỖI: Cổng ${PORT} đã bị chiếm dụng!`);
      console.error(`👉 Vui lòng chạy lệnh 'npm run clean' để dọn dẹp các tiến trình cũ trước khi chạy lại.`);
      process.exit(1);
    } else {
      console.error(`\n❌ API Server Error:`, err.message);
    }
  });

  // Dọn dẹp CrawlLog bị treo (running nhưng quá cũ)
  try {
    const staleThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 giờ
    const cleaned = await CrawlLog.updateMany(
      { status: 'running', updatedAt: { $lt: staleThreshold } },
      { $set: { status: 'failed', finishedAt: new Date() }, $push: { errorMessages: 'Auto-closed: stale running log' } }
    );
    if (cleaned.modifiedCount > 0) {
      console.log(`🧹 Đã dọn ${cleaned.modifiedCount} CrawlLog bị treo`);
    }
  } catch (e) { /* ignore */ }

  // Schedule auto-crawl mỗi 15 phút (giảm từ 5 phút để bớt tải)
  const schedule = process.env.CRON_SCHEDULE || '*/15 * * * *';
  cron.schedule(schedule, runAutoCrawl);
  console.log(`\n⏰ Auto-crawl schedule: ${schedule}`);
  console.log(`🔄 Skip threshold: ${config.crawl.skipThreshold} bản cũ liên tiếp → dừng sớm`);

  // Mặc định không chạy crawl lúc khởi động để tránh tranh browser với mega crawl/manual job.
  // Nếu cần bật lại: STARTUP_AUTO_CRAWL=true npm run dev:backend
  if (process.env.STARTUP_AUTO_CRAWL === 'true') {
    console.log(`\n🚀 Crawl lần đầu sau 5 giây...`);
    setTimeout(runAutoCrawl, 5000);
  } else {
    console.log(`\n⏸️ Bỏ qua crawl khởi động. Bật STARTUP_AUTO_CRAWL=true nếu cần.`);
  }

  // Tính toán stats ban đầu
  setTimeout(refreshStats, 2000);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Đang shutdown...');
    await closeBrowser();
    await closeDB();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await closeBrowser();
    await closeDB();
    process.exit(0);
  });
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await closeBrowser();
  process.exit(1);
});
