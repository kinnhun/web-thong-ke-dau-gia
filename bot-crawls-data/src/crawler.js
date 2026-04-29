/**
 * Bot cào dữ liệu đấu giá từ dgts.moj.gov.vn (v2)
 *
 * Sử dụng:
 *   node src/crawler.js                    # Cào tất cả (list + detail + sample)
 *   node src/crawler.js --type=auction     # Chỉ cào thông báo đấu giá
 *   node src/crawler.js --type=org         # Chỉ cào lựa chọn tổ chức
 *   node src/crawler.js --type=redetail    # Re-crawl detail cho items chưa có
 *   node src/crawler.js --maxPages=5       # Giới hạn số trang
 */
const { connectDB } = require('./db');
const { closeBrowser } = require('./browser');
const { crawlAuctionNotices } = require('./scrapers/auctionNotice.scraper');
const { crawlOrgSelections } = require('./scrapers/orgSelection.scraper');
const { crawlDetails, crawlOrgDetails } = require('./scrapers/detail.scraper');

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
  const listOnly = args.listOnly === true || args.listOnly === 'true';

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   🤖 BOT CÀO DỮ LIỆU ĐẤU GIÁ v2       ║');
  console.log('║   Mode: List + Detail + Sample           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n⚙️  Type: ${type} | MaxPages: ${maxPages || 'unlimited'} | StartPage: ${startPage} | ListOnly: ${listOnly ? 'yes' : 'no'}`);

  await connectDB();

  const startTime = Date.now();

  try {
    if (type === 'all' || type === 'auction') {
      console.log('\n' + '═'.repeat(50));
      console.log('📋 Thông báo công khai việc đấu giá (list + detail + sample)');
      console.log('═'.repeat(50));
      await crawlAuctionNotices({ maxPages, startPage, pageSize, listOnly });
    }

    if (type === 'all' || type === 'org') {
      console.log('\n' + '═'.repeat(50));
      console.log('🏢 Lựa chọn tổ chức đấu giá (list + detail + sample)');
      console.log('═'.repeat(50));
      await crawlOrgSelections({ maxPages, startPage, pageSize });
    }

    if (type === 'redetail') {
      console.log('\n' + '═'.repeat(50));
      console.log('🔍 Re-crawl detail cho items chưa có');
      console.log('═'.repeat(50));
      await crawlDetails({ maxItems });
      await crawlOrgDetails({ maxItems });
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
