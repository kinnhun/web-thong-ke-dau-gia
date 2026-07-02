const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const { 
  extractPropertyIdentifiers, 
  extractCoreIdentity, 
  jaccardSimilarity, 
  overlapSimilarity, 
  getBigrams,
  hasConflictingIdentifiers,
  hasMatchingStrongIdentifiers,
  getNumberTokens
} = require('./bot-crawls-data/src/utils/helpers');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const id1 = 570261;
  const id2 = 531198;
  const id3 = 121662;

  const n1 = await AuctionNotice.findOne({ sourceId: id1 }).lean();
  const n2 = await AuctionNotice.findOne({ sourceId: id2 }).lean();
  const n3 = await AuctionNotice.findOne({ sourceId: id3 }).lean();

  function analyze(noticeA, noticeB) {
    console.log(`\n=== Comparing #${noticeA.sourceId} and #${noticeB.sourceId} ===`);
    console.log(`A: "${noticeA.name}"`);
    console.log(`B: "${noticeB.name}"`);

    const idsA = extractPropertyIdentifiers(noticeA.name);
    const idsB = extractPropertyIdentifiers(noticeB.name);

    console.log('Identifiers A:', idsA);
    console.log('Identifiers B:', idsB);

    const conflict = hasConflictingIdentifiers(idsA, idsB);
    const strongMatch = hasMatchingStrongIdentifiers(idsA, idsB);

    const coreA = extractCoreIdentity(noticeA.name);
    const coreB = extractCoreIdentity(noticeB.name);
    console.log('Core A:', coreA);
    console.log('Core B:', coreB);

    const bgA = getBigrams(coreA);
    const bgB = getBigrams(coreB);

    const coreSim = jaccardSimilarity(bgA, bgB);
    const ovSim = overlapSimilarity(bgA, bgB);

    const numsA = getNumberTokens(noticeA.name);
    const numsB = getNumberTokens(noticeB.name);
    const commonNumbers = numsA.filter(n => numsB.includes(n));

    console.log('Conflict:', conflict);
    console.log('Strong Match:', strongMatch);
    console.log('Core Similarity:', coreSim);
    console.log('Overlap Similarity:', ovSim);
    console.log('Numbers A:', numsA);
    console.log('Numbers B:', numsB);
    console.log('Common Numbers:', commonNumbers);

    let match = false;
    let reason = "";
    if (conflict) {
      match = false;
      reason = "Xung đột định danh";
    } else if (strongMatch) {
      match = true;
      reason = "Khớp định danh mạnh (Plot/Map/GCN)";
    } else if (coreSim >= 0.8) {
      match = true;
      reason = "Core Sim >= 80%";
    } else if (numsA.length > 0 && numsB.length > 0 && coreSim >= 0.55 && commonNumbers.length > 0) {
      match = true;
      reason = "Core Sim >= 55% + Có số chung";
    } else if (numsA.length > 0 && numsB.length > 0 && ovSim >= 0.85 && commonNumbers.length >= 1) {
      match = true;
      reason = "Overlap Sim >= 85% + Có số chung";
    } else if (idsA.apartment && idsA.apartment === idsB.apartment && (coreSim >= 0.20 || ovSim >= 0.33)) {
      match = true;
      reason = "Apartment Match";
    } else if (idsA.houseNumber && idsA.houseNumber === idsB.houseNumber && ovSim >= 0.60) {
      match = true;
      reason = "House Number Match";
    }

    console.log(`MATCHED: ${match} (Reason: ${reason})`);
  }

  analyze(n1, n2);
  analyze(n2, n3);

  await mongoose.connection.close();
}

run().catch(console.error);
