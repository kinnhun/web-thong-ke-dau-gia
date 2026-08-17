const { initBrowser, closeBrowser } = require('../src/browser');
const { fetchAuctionItemDetail } = require('../src/scrapers/detail.scraper');

async function main() {
  console.log('Testing detail fetch for sourceId 620919...');
  await initBrowser();
  try {
    const res = await fetchAuctionItemDetail(620919);
    console.log('SUCCESS RESULT:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('FAILED WITH ERROR:', err.stack || err.message);
  }
  await closeBrowser();
  process.exit(0);
}

main().catch(console.error);
