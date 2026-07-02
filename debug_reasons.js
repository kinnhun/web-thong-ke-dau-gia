const mongoose = require('mongoose');
const fs = require('fs');
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

  const ids = [531198, 568616, 462040, 336284, 327027, 325855, 163076, 148592, 143346];
  const notices = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();
  const noticeMap = new Map(notices.map(n => [n.sourceId, n]));

  let output = '=== IDENTIFIERS FOR EACH NOTICE ===\n';
  for (const id of ids) {
    const notice = noticeMap.get(id);
    if (!notice) {
      output += `Notice #${id} not found in DB\n`;
      continue;
    }
    const extracted = extractPropertyIdentifiers(notice.name);
    output += `\nID: ${id}\n`;
    output += `Name: "${notice.name}"\n`;
    output += `Extracted Identifiers: ${JSON.stringify(extracted, null, 2)}\n`;
    output += `Core Identity: "${extractCoreIdentity(notice.name)}"\n`;
    output += `Number Tokens: ${JSON.stringify(getNumberTokens(notice.name))}\n`;
  }

  output += '\n=== PAIRWISE MATCH CHECK ===\n';
  for (let i = 0; i < ids.length; i++) {
    const idA = ids[i];
    const nA = noticeMap.get(idA);
    if (!nA) continue;
    const idsA = extractPropertyIdentifiers(nA.name);
    const coreA = extractCoreIdentity(nA.name);
    const bgA = getBigrams(coreA);
    const numsA = getNumberTokens(nA.name);

    for (let j = i + 1; j < ids.length; j++) {
      const idB = ids[j];
      const nB = noticeMap.get(idB);
      if (!nB) continue;
      const idsB = extractPropertyIdentifiers(nB.name);
      
      const conflict = hasConflictingIdentifiers(idsA, idsB);
      const strongMatch = hasMatchingStrongIdentifiers(idsA, idsB);
      
      const coreB = extractCoreIdentity(nB.name);
      const bgB = getBigrams(coreB);
      const coreSim = jaccardSimilarity(bgA, bgB);
      const ovSim = overlapSimilarity(bgA, bgB);
      
      const numsB = getNumberTokens(nB.name);
      const bothHaveNumbers = numsA.length > 0 && numsB.length > 0;
      const commonNumbers = bothHaveNumbers ? numsA.filter(n => numsB.includes(n)) : [];

      let match = false;
      let reason = "";
      if (conflict) {
        match = false;
        reason = "Xung đột định danh";
      } else if (strongMatch) {
        match = true;
        reason = "Khớp định danh mạnh";
      } else if (coreSim >= 0.8) {
        match = true;
        reason = "Core Sim >= 80%";
      } else if (bothHaveNumbers && coreSim >= 0.55 && commonNumbers.length > 0) {
        match = true;
        reason = "Core Sim >= 55% + Có số chung";
      } else if (bothHaveNumbers && ovSim >= 0.85 && commonNumbers.length >= 1) {
        match = true;
        reason = "Overlap Sim >= 85% + Có số chung";
      } else if (idsA.apartment && idsA.apartment === idsB.apartment && (coreSim >= 0.20 || ovSim >= 0.33)) {
        match = true;
        reason = `Apartment Match ("${idsA.apartment}")`;
      } else if (idsA.houseNumber && idsA.houseNumber === idsB.houseNumber && ovSim >= 0.60) {
        match = true;
        reason = "House Number Match";
      }

      if (match) {
        output += `[MATCH] ${idA} and ${idB}\n`;
        output += `  Reason: ${reason}\n`;
        output += `  A: "${nA.name}"\n`;
        output += `  B: "${nB.name}"\n`;
      }
    }
  }

  fs.writeFileSync('debug_reasons_fixed.txt', output, 'utf-8');
  console.log('Done!');
  await mongoose.connection.close();
}

run().catch(console.error);
