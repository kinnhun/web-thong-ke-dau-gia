/**
 * Bot cào dữ liệu đấu giá từ dgts.moj.gov.vn
 *
 * Sử dụng:
 *   node src/crawler.js                    # Cào tất cả
 *   node src/crawler.js --type=auction     # Chỉ cào thông báo đấu giá
 *   node src/crawler.js --type=org         # Chỉ cào lựa chọn tổ chức
 *   node src/crawler.js --type=detail      # Chỉ cào chi tiết
 *   node src/crawler.js --maxPages=5       # Giới hạn số trang
 */
const { connectDB } = require('./db');
const { closeBrowser } = require('./browser');
const { crawlAuctionNotices } = require('./scrapers/auctionNotice.scraper');
const { crawlOrgSelections } = require('./scrapers/orgSelection.scraper');
const { crawlDetails } = require('./scrapers/detail.scraper');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    args[key] = val || true;
  });
  return args;
}

async function main() {
  const args = parseArgs();
  const type = args.type || 'all';
  const maxPages = args.maxPages ? parseInt(args.maxPages) : 0;
  const startPage = args.startPage ? parseInt(args.startPage) : 1;
  const pageSize = args.pageSize ? parseInt(args.pageSize) : 20;
  const maxItems = args.maxItems ? parseInt(args.maxItems) : 100;

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   🤖 BOT CÀO DỮ LIỆU ĐẤU GIÁ          ║');
  console.log('║   Nguồn: dgts.moj.gov.vn                ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n⚙️  Type: ${type} | MaxPages: ${maxPages || 'unlimited'} | StartPage: ${startPage}`);

  await connectDB();

  const startTime = Date.now();

  try {
    if (type === 'all' || type === 'auction') {
      console.log('\n' + '═'.repeat(50));
      console.log('📋 PHẦN 1: Thông báo công khai việc đấu giá');
      console.log('═'.repeat(50));
      await crawlAuctionNotices({ maxPages, startPage, pageSize });
    }

    if (type === 'all' || type === 'org') {
      console.log('\n' + '═'.repeat(50));
      console.log('🏢 PHẦN 2: Thông báo lựa chọn tổ chức đấu giá');
      console.log('═'.repeat(50));
      await crawlOrgSelections({ maxPages, startPage, pageSize });
    }

    if (type === 'all' || type === 'detail') {
      console.log('\n' + '═'.repeat(50));
      console.log('🔍 PHẦN 3: Cào chi tiết từng thông báo');
      console.log('═'.repeat(50));
      await crawlDetails({ maxItems });
    }
  } catch (err) {
    console.error('\n💥 Lỗi nghiêm trọng:', err.message);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Tổng thời gian: ${elapsed}s`);
  console.log('🏁 Bot kết thúc.\n');

  await closeBrowser();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await closeBrowser();
  process.exit(1);
});
