const mongoose = require('mongoose');
const { extractCoreIdentity, extractPropertyIdentifiers, getBigrams, jaccardSimilarity, overlapSimilarity } = require('../bot-crawls-data/src/utils/helpers');

async function debug() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  const AuctionNotice = mongoose.model('AuctionNotice', new mongoose.Schema({}, { strict: false }));

  const itemA = await AuctionNotice.findOne({ sourceId: 268652 }).lean();
  const itemB = await AuctionNotice.findOne({ sourceId: 466453 }).lean();
  const itemC = await AuctionNotice.findOne({ sourceId: 566714 }).lean();

  const idsA = extractPropertyIdentifiers(itemA.name);
  const idsB = extractPropertyIdentifiers(itemB.name);
  const idsC = extractPropertyIdentifiers(itemC.name);

  console.log('A Identifiers:', idsA);
  console.log('B Identifiers:', idsB);
  console.log('C Identifiers:', idsC);

  const coreA = extractCoreIdentity(itemA.name);
  const coreB = extractCoreIdentity(itemB.name);
  const coreC = extractCoreIdentity(itemC.name);

  console.log(`Core A: "${coreA}"`);
  console.log(`Core B: "${coreB}"`);
  console.log(`Core C: "${coreC}"`);

  console.log('A vs B Overlap:', overlapSimilarity(getBigrams(coreA), getBigrams(coreB)));
  console.log('A vs C Overlap:', overlapSimilarity(getBigrams(coreA), getBigrams(coreC)));
  console.log('B vs C Overlap:', overlapSimilarity(getBigrams(coreB), getBigrams(coreC)));

  await mongoose.disconnect();
}

debug().catch(console.error);
