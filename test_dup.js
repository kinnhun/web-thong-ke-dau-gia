require('dotenv').config({ path: 'bot-crawls-data/.env' });
const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const { extractCoreIdentity, extractPropertyIdentifiers, hasConflictingIdentifiers, getBigrams, getNumberTokens, jaccardSimilarity } = require('./bot-crawls-data/src/utils/helpers');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const id1 = 454852;
  const id2 = 561763;
  const id3 = 471403;

  const items = await AuctionNotice.find({ sourceId: { $in: [id1, id2, id3] } }).lean();
  console.log(`Found ${items.length} items.`);
  
  for (let item of items) {
    console.log(`\nID: ${item.sourceId}`);
    console.log(`Name: ${item.name}`);
    console.log(`Core: ${extractCoreIdentity(item.name)}`);
    console.log(`Numbers: ${getNumberTokens(item.name)}`);
    console.log(`Identifiers:`, extractPropertyIdentifiers(item.name));
  }

  // test text search
  if (items.length > 0) {
    const targetName = items[0].name;
    const candidates = await AuctionNotice.find(
      { $text: { $search: targetName } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } }).limit(100).lean();

    console.log(`\nText search for "${targetName}" returned ${candidates.length} results.`);
    console.log(`Does it contain id2 (${id2})?`, candidates.some(c => c.sourceId === id2));
    console.log(`Does it contain id3 (${id3})?`, candidates.some(c => c.sourceId === id3));
  }

  mongoose.disconnect();
}
test().catch(console.error);
