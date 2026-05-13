const { connectDB } = require('./bot-crawls-data/src/utils/helpers');
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
const mongoose = require('mongoose');

async function debugMatch(id1, id2) {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  
  const item1 = await AuctionNotice.findOne({ sourceId: id1 });
  const item2 = await AuctionNotice.findOne({ sourceId: id2 });
  
  if (!item1 || !item2) {
    console.log(`Không tìm thấy item: ${!item1 ? id1 : ''} ${!item2 ? id2 : ''}`);
    process.exit(1);
  }
  
  console.log('--- SO SÁNH DỮ LIỆU THỰC TẾ TRONG DB ---');
  console.log(`Tài sản 1 (#${id1}): ${item1.name}`);
  console.log(`Tài sản 2 (#${id2}): ${item2.name}`);
  
  const ids1 = extractPropertyIdentifiers(item1.name + ' ' + (item1.description || ''));
  const ids2 = extractPropertyIdentifiers(item2.name + ' ' + (item2.description || ''));
  
  console.log('\n--- Identifiers extracted ---');
  console.log('ID 1:', JSON.stringify(ids1, null, 2));
  console.log('ID 2:', JSON.stringify(ids2, null, 2));
  
  const conflict = hasConflictingIdentifiers(ids1, ids2);
  const strongMatch = hasMatchingStrongIdentifiers(ids1, ids2);
  
  const core1 = extractCoreIdentity(item1.name + ' ' + (item1.description || ''));
  const core2 = extractCoreIdentity(item2.name + ' ' + (item2.description || ''));
  
  const coreSim = jaccardSimilarity(getBigrams(core1), getBigrams(core2));
  const ovSim = overlapSimilarity(getBigrams(core1), getBigrams(core2));
  
  const nums1 = getNumberTokens(item1.name + ' ' + (item1.description || ''));
  const nums2 = getNumberTokens(item2.name + ' ' + (item2.description || ''));
  const commonNums = nums1.filter(n => nums2.includes(n));
  
  console.log('\n--- Match Metrics ---');
  console.log('Conflict:', conflict);
  console.log('Strong Match:', strongMatch);
  console.log('Core Similarity:', (coreSim * 100).toFixed(2) + '%');
  console.log('Overlap Similarity:', (ovSim * 100).toFixed(2) + '%');
  console.log('Common Numbers:', commonNums);
  
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
  } else if (nums1.length > 0 && nums2.length > 0 && coreSim >= 0.55 && commonNums.length > 0) {
    match = true;
    reason = "Core Sim >= 55% + Có số chung";
  } else if (nums1.length > 0 && nums2.length > 0 && ovSim >= 0.85 && commonNums.length >= 1) {
    match = true;
    reason = "Overlap Sim >= 85% + Có số chung";
  }
  
  console.log('\n--- KẾT QUẢ CUỐI CÙNG ---');
  console.log(`DỰ ĐOÁN: ${match ? 'TRÙNG LẶP ✅' : 'KHÔNG TRÙNG ❌'} (${reason || 'Không thỏa điều kiện'})`);
  
  await mongoose.connection.close();
}

const [id1, id2] = process.argv.slice(2).map(Number);
if (id1 && id2) {
  debugMatch(id1, id2);
} else {
  console.log('Cách dùng: node debug_match.js <id1> <id2>');
}
