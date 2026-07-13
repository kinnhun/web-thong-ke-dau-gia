const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const helpers = require('./bot-crawls-data/src/utils/helpers');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const ids = [558463, 533565, 585738];
  const notices = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();
  const nMap = new Map(notices.map(n => [n.sourceId, n]));

  const n558463 = nMap.get(558463);
  const n533565 = nMap.get(533565);
  const n585738 = nMap.get(585738);

  const ids558463 = helpers.extractPropertyIdentifiers(n558463.name);
  const ids533565 = helpers.extractPropertyIdentifiers(n533565.name);
  const ids585738 = helpers.extractPropertyIdentifiers(n585738.name);

  console.log(`Identifiers 558463:`, ids558463);
  console.log(`Identifiers 533565:`, ids533565);
  console.log(`Identifiers 585738:`, ids585738);

  console.log(`\n--- Comparing 558463 vs 533565 ---`);
  const core558463 = helpers.extractCoreIdentity(n558463.name);
  const core533565 = helpers.extractCoreIdentity(n533565.name);
  const bg558463 = helpers.getBigrams(core558463);
  const bg533565 = helpers.getBigrams(core533565);
  const sim1 = helpers.jaccardSimilarity(bg558463, bg533565);
  const ov1 = helpers.overlapSimilarity(bg558463, bg533565);
  console.log(`Core 558463: "${core558463}"`);
  console.log(`Core 533565: "${core533565}"`);
  console.log(`Jaccard similarity: ${sim1}`);
  console.log(`Overlap similarity: ${ov1}`);
  console.log(`Conflicting:`, helpers.hasConflictingIdentifiers(ids558463, ids533565));
  console.log(`Strong match:`, helpers.hasMatchingStrongIdentifiers(ids558463, ids533565));

  console.log(`\n--- Comparing 533565 vs 585738 ---`);
  const core585738 = helpers.extractCoreIdentity(n585738.name);
  const bg585738 = helpers.getBigrams(core585738);
  const sim2 = helpers.jaccardSimilarity(bg533565, bg585738);
  const ov2 = helpers.overlapSimilarity(bg533565, bg585738);
  console.log(`Core 585738: "${core585738}"`);
  console.log(`Jaccard similarity: ${sim2}`);
  console.log(`Overlap similarity: ${ov2}`);
  console.log(`Conflicting:`, helpers.hasConflictingIdentifiers(ids533565, ids585738));
  console.log(`Strong match:`, helpers.hasMatchingStrongIdentifiers(ids533565, ids585738));

  await mongoose.connection.close();
}

run().catch(console.error);
