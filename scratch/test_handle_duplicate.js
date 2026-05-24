const mongoose = require('mongoose');
const { searchDuplicatesByFuzzyName, handleDuplicate } = require('../bot-crawls-data/src/scrapers/detail.scraper');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');
const Duplicate = require('../bot-crawls-data/src/models/Duplicate');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  console.log('✅ Connected to MongoDB');

  const itemA = await AuctionNotice.findOne({ sourceId: 268652 }).lean();
  console.log(`\nItem A: ${itemA.sourceId} - "${itemA.name}"`);

  console.log('\n--- Calling searchDuplicatesByFuzzyName ---');
  const exactNameRelatedIds = await searchDuplicatesByFuzzyName(itemA.sourceId, itemA.name, 'auction');
  console.log('Returned exactNameRelatedIds:', exactNameRelatedIds);

  const allRelatedIds = [...new Set([...(itemA.relatedIds || []), ...exactNameRelatedIds])];
  console.log('All Related IDs to merge:', allRelatedIds);

  console.log('\n--- Calling handleDuplicate ---');
  const result = await handleDuplicate(itemA.sourceId, itemA.name, allRelatedIds, 'auction');
  console.log('handleDuplicate finished.');

  console.log('\n--- Checking final Duplicate collection for these IDs ---');
  const ids = [268652, 466453, 566714];
  for (const id of ids) {
    const dup = await Duplicate.findOne({ sourceIds: id }).lean();
    if (dup) {
      console.log(`ID #${id} is in Duplicate: ID: ${dup._id}, Name: "${dup.name}", Source IDs: [${dup.sourceIds.join(', ')}]`);
    } else {
      console.log(`ID #${id} is NOT in any duplicate group.`);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
