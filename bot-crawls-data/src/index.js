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
    await crawlAuctionNotices({ isAuto: true });

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

  // Start API server ngay lập tức để mở cổng 4321, tránh lỗi proxy socket hang up
  const { createServer } = require('./api/server');
  const server = createServer();
  const PORT = config.api.port || 4321;
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

  await connectDB();

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
  // Tự động cào lần đầu ngay lập tức khi vừa khởi động hệ thống, sau đó 15 phút 1 lần
  if (process.env.STARTUP_AUTO_CRAWL !== 'false') {
    console.log(`\n🚀 Lần đầu khởi động: Tự động cào dữ liệu ngay lập tức...`);
    setTimeout(runAutoCrawl, 1000);
  } else {
    console.log(`\n⏸️ Bỏ qua crawl khởi động do STARTUP_AUTO_CRAWL=false.`);
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
