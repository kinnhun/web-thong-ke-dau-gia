const mongoose = require('mongoose');
const config = require('./bot-crawls-data/src/config');
const { getFuzzyNameGroupsFiltered } = require('./bot-crawls-data/src/scrapers/detail.scraper');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function verify() {
  await mongoose.connect(config.mongo.uri);
  console.log("Connected to DB.");

  const sourceIds = [531198, 568616, 462040, 336284, 327027, 325855, 163076, 148592, 143346];
  const items = await AuctionNotice.find({ sourceId: { $in: sourceIds } }).lean();
  console.log(`Loaded ${items.length} items to check.`);

  // Let's run the algorithm on just these items
  const groups = await getFuzzyNameGroupsFiltered(items, () => {});
  console.log("\n=== CLUSTERING RESULTS ===");
  console.log(JSON.stringify(groups, null, 2));

  await mongoose.disconnect();
}

verify().catch(console.error);
