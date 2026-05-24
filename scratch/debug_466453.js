const mongoose = require('mongoose');
const { extractCoreIdentity, extractPropertyIdentifiers, getBigrams, jaccardSimilarity, overlapSimilarity } = require('../bot-crawls-data/src/utils/helpers');

async function debug() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  const AuctionNotice = mongoose.model('AuctionNotice', new mongoose.Schema({}, { strict: false }));

  const itemA = await AuctionNotice.findOne({ sourceId: 268652 }).lean();
  const itemB = await AuctionNotice.findOne({ sourceId: 466453 }).lean();
  const itemC = await AuctionNotice.findOne({ sourceId: 566714 }).lean();

  console.log(`Item A (268652): "${itemA.name}"`);
  console.log(`Item B (466453): "${itemB.name}"`);
  console.log(`Item C (566714): "${itemC.name}"`);

  // Compare B (466453) vs C (566714)
  const idsB = extractPropertyIdentifiers(itemB.name);
  const idsC = extractPropertyIdentifiers(itemC.name);
  console.log('\n--- Identifiers ---');
  console.log('B:', idsB);
  console.log('C:', idsC);

  const coreB = extractCoreIdentity(itemB.name);
  const coreC = extractCoreIdentity(itemC.name);
  console.log('\n--- Core Identities ---');
  console.log(`Core B: "${coreB}"`);
  console.log(`Core C: "${coreC}"`);

  const bigramsB = getBigrams(coreB);
  const bigramsC = getBigrams(coreC);
  const sim = jaccardSimilarity(bigramsB, bigramsC);
  const overlap = overlapSimilarity(bigramsB, bigramsC);
  console.log(`Similarity: ${sim.toFixed(3)} | Overlap: ${overlap.toFixed(3)}`);

  // Let's check why B was not grouped with C.
  // Wait, does C (566714) have 466453 in its relatedIds?
  console.log('\n--- Related IDs ---');
  console.log('A relatedIds:', itemA.relatedIds);
  console.log('B relatedIds:', itemB.relatedIds);
  console.log('C relatedIds:', itemC.relatedIds);

  await mongoose.disconnect();
}

debug().catch(console.error);
