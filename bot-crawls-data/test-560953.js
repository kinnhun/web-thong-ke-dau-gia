const { connectDB } = require('./src/db');
const { crawlDetails } = require('./src/scrapers/detail.scraper');
const AuctionNotice = require('./src/models/AuctionNotice');

async function main() {
  await connectDB();
  await AuctionNotice.updateOne({sourceId: 560953}, { detailScraped: false });
  await crawlDetails({maxItems: 1});
  const item = await AuctionNotice.findOne({sourceId: 560953});
  console.log(item);
  process.exit(0);
}

main().catch(console.error);
