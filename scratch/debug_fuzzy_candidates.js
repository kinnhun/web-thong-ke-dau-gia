const mongoose = require('mongoose');
const {
  extractCoreIdentity,
  extractPropertyIdentifiers,
  getBigrams,
  jaccardSimilarity,
  overlapSimilarity,
  getNumberTokens,
  hasConflictingIdentifiers,
  hasMatchingStrongIdentifiers
} = require('../bot-crawls-data/src/utils/helpers');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  const AuctionNotice = mongoose.model('AuctionNotice', new mongoose.Schema({}, { strict: false }));

  const itemA = await AuctionNotice.findOne({ sourceId: 268652 }).lean();
  console.log(`Target A: ${itemA.sourceId} - "${itemA.name}"`);

  const name = itemA.name;
  const sourceId = itemA.sourceId;

  // Simulate searchDuplicatesByFuzzyName candidate selection
  const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targetNumbers = getNumberTokens(name);
  const targetIdentifiers = extractPropertyIdentifiers(name);
  
  // 1. Text search
  const dbQuery = { $text: { $search: name } };
  
  // 2. Regex queries
  let regexDbQuery = null;
  const searchNumbers = targetNumbers.slice(0, 10);
  if (searchNumbers.length > 0) {
    const regexQueries = searchNumbers.map(num => ({ name: { $regex: "(^|\\s)" + escapeRegex(num) + "(\\s|$|\\.|,|\\)|/)", $options: 'i' } }));
    regexDbQuery = { 
      $text: { $search: searchNumbers.join(' ') },
      $or: regexQueries 
    };
  }

  // 3. Strong queries
  let strongDbQuery = null;
  const strongKeys = [
    'licensePlate', 'chassisNumber', 'engineNumber', 
    'certificateNumber', 'certificateEntryNumber', 'shipNumber', 
    'taxCode', 'contractNumber', 'ownerName', 'stockAmount', 'serialNumber', 'debtorName', 'apartment'
  ];
  if (targetIdentifiers.houseNumber && (targetIdentifiers.houseNumber.includes('/') || targetIdentifiers.houseNumber.includes('-') || targetIdentifiers.houseNumber.length >= 3)) {
      strongKeys.push('houseNumber');
  }
  
  const hasAnyStrongKey = strongKeys.some(k => targetIdentifiers[k]);
  if (hasAnyStrongKey) {
      const strongQueries = [];
      const strongTokens = [];
      const pushStrong = (idVal) => {
          if (idVal) {
              strongQueries.push({ name: { $regex: escapeRegex(idVal), $options: 'i' } });
              strongTokens.push(idVal);
          }
      };
      for (const key of strongKeys) {
          pushStrong(targetIdentifiers[key]);
      }
      if (strongQueries.length > 0) {
          strongDbQuery = { 
              $text: { $search: strongTokens.join(' ') },
              $or: strongQueries 
          };
      }
  }

  console.log('\nRunning candidates search in DB...');
  const [dbCandidates, dbCandidatesRegex, dbCandidatesStrong] = await Promise.all([
    AuctionNotice.find(dbQuery).limit(300).select('sourceId name').lean(),
    regexDbQuery ? AuctionNotice.find(regexDbQuery).limit(200).select('sourceId name').lean() : Promise.resolve([]),
    strongDbQuery ? AuctionNotice.find(strongDbQuery).limit(200).select('sourceId name').lean() : Promise.resolve([])
  ]);

  const candidates = [...dbCandidates, ...dbCandidatesRegex, ...dbCandidatesStrong];
  console.log(`Found total raw candidates: ${candidates.length}`);

  // Distinct by sourceId
  const candidateMap = new Map();
  candidates.forEach(c => candidateMap.set(c.sourceId, c));
  
  console.log(`Unique candidates count: ${candidateMap.size}`);

  const targetCore = extractCoreIdentity(name);
  const targetCoreBigrams = getBigrams(targetCore);

  console.log('\nEvaluating target candidates (466453 and 566714):');
  
  const targetSids = [466453, 566714];
  for (const sid of targetSids) {
    const c = candidateMap.get(sid);
    if (!c) {
      console.log(`Candidate #${sid} was NOT found in the database candidates query lists!`);
      continue;
    }
    console.log(`\nCandidate #${sid}: "${c.name}"`);
    const candidateNumbers = getNumberTokens(c.name);
    const candidateIdentifiers = extractPropertyIdentifiers(c.name);

    const conflict = hasConflictingIdentifiers(targetIdentifiers, candidateIdentifiers);
    const strongMatch = hasMatchingStrongIdentifiers(targetIdentifiers, candidateIdentifiers);
    
    console.log(`  Conflict: ${conflict} | StrongMatch: ${strongMatch}`);
    
    const candidateCore = extractCoreIdentity(c.name);
    const candidateCoreBigrams = getBigrams(candidateCore);
    const coreSim = jaccardSimilarity(targetCoreBigrams, candidateCoreBigrams);
    const overlapSim = overlapSimilarity(targetCoreBigrams, candidateCoreBigrams);
    const bothHaveNumbers = targetNumbers.length > 0 && candidateNumbers.length > 0;
    const commonNumbers = bothHaveNumbers ? targetNumbers.filter(t => candidateNumbers.includes(t)) : [];

    console.log(`  CoreSim: ${coreSim.toFixed(3)} | OverlapSim: ${overlapSim.toFixed(3)} | CommonNums: [${commonNumbers}]`);

    let match = false;
    let reason = '';

    if (conflict) {
      match = false;
      reason = 'Conflict';
    } else if (strongMatch) {
      match = true;
      reason = 'Strong match';
    } else if (coreSim >= 0.8) {
      match = true;
      reason = 'CoreSim >= 0.8';
    } else if (bothHaveNumbers && coreSim >= 0.55 && commonNumbers.length > 0) {
      match = true;
      reason = 'Numbers + CoreSim >= 0.55';
    } else if (bothHaveNumbers && overlapSim >= 0.85 && commonNumbers.length >= 1) {
      match = true;
      reason = 'Numbers + OverlapSim >= 0.85';
    } else if (targetIdentifiers.apartment && targetIdentifiers.apartment === candidateIdentifiers.apartment && (coreSim >= 0.20 || overlapSim >= 0.33)) {
      match = true;
      reason = 'Apartment match';
    } else if (targetIdentifiers.houseNumber && targetIdentifiers.houseNumber === candidateIdentifiers.houseNumber && overlapSim >= 0.60) {
      match = true;
      reason = 'HouseNumber + OverlapSim >= 0.60';
    } else {
      reason = 'No rules satisfied';
    }

    console.log(`  => RESULT: ${match ? 'MATCH' : 'REJECT'} (${reason})`);
  }

  await mongoose.disconnect();
}

test().catch(console.error);
