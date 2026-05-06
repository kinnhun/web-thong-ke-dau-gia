require('dotenv').config({ path: './bot-crawls-data/.env' });
const mongoose = require('mongoose');
const { extractProvince, getNumberTokens, extractCoreIdentity, getBigrams, jaccardSimilarity, overlapSimilarity, extractPropertyIdentifiers, hasConflictingIdentifiers, hasMatchingStrongIdentifiers } = require('../bot-crawls-data/src/utils/helpers');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function localSearch(sourceId, name) {
  const type = 'auction';
  const Model = AuctionNotice;
  
  const targetProvince = extractProvince(name);
  const targetNumbers = getNumberTokens(name);
  const targetCore = extractCoreIdentity(name);
  const targetCoreBigrams = getBigrams(targetCore);
  const targetIdentifiers = extractPropertyIdentifiers(name);

  console.log('Target Core:', targetCore);
  console.log('Target Numbers:', targetNumbers);

  // Giả lập candidate collection từ DB
  const group2Ids = [457469, 472434, 491001, 507358, 522961, 536469, 550839];
  const candidates = await Model.find({ sourceId: { $in: group2Ids } }).lean();

  const relatedIds = [];

  for (const c of candidates) {
    const candidateNumbers = getNumberTokens(c.name);
    const candidateIdentifiers = extractPropertyIdentifiers(c.name);
    const candidateCore = extractCoreIdentity(c.name);
    const candidateCoreBigrams = getBigrams(candidateCore);

    console.log(`\nChecking [${c.sourceId}]: ${c.name}`);
    console.log(`Candidate Core: ${candidateCore}`);

    if (hasConflictingIdentifiers(targetIdentifiers, candidateIdentifiers)) {
      console.log('-> Conflicting identifiers');
      continue;
    }

    if (hasMatchingStrongIdentifiers(targetIdentifiers, candidateIdentifiers)) {
      console.log('-> Matching strong identifiers');
      relatedIds.push(c.sourceId);
      continue;
    }

    const bothHaveNumbers = targetNumbers.length > 0 && candidateNumbers.length > 0;
    let commonNumbers = [];
    if (bothHaveNumbers) {
      commonNumbers = targetNumbers.filter(t => candidateNumbers.includes(t));
    }
    console.log('Common numbers:', commonNumbers);

    const coreSim = jaccardSimilarity(targetCoreBigrams, candidateCoreBigrams);
    const overlapSim = overlapSimilarity(targetCoreBigrams, candidateCoreBigrams);
    console.log(`Core Sim: ${coreSim.toFixed(2)}, Overlap: ${overlapSim.toFixed(2)}`);

    if (coreSim >= 0.80) {
      console.log('-> MATCH: Core Sim >= 0.80');
      relatedIds.push(c.sourceId);
      continue;
    }

    if (bothHaveNumbers && coreSim >= 0.55 && commonNumbers.length > 0) {
      console.log('-> MATCH: Numbers + Core Sim >= 0.55');
      relatedIds.push(c.sourceId);
      continue;
    }

    if (bothHaveNumbers && overlapSim >= 0.85 && commonNumbers.length >= 1) {
      console.log('-> MATCH: Numbers + Overlap >= 0.85');
      relatedIds.push(c.sourceId);
      continue;
    }
  }

  return relatedIds;
}

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  try {
    const sourceId = 441901;
    const item = await AuctionNotice.findOne({ sourceId }).lean();
    const related = await localSearch(sourceId, item.name);
    console.log('\nFinal Related IDs:', related);
  } finally {
    mongoose.disconnect();
  }
});
