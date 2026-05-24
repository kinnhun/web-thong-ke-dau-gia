const {
  extractCoreIdentity,
  extractPropertyIdentifiers,
  hasConflictingIdentifiers,
  hasMatchingStrongIdentifiers,
  getBigrams,
  jaccardSimilarity,
  overlapSimilarity,
  getNumberTokens
} = require('../bot-crawls-data/src/utils/helpers');

function runTest(name, text1, text2) {
  console.log(`\n=================== TEST: ${name} ===================`);
  
  const ids1 = extractPropertyIdentifiers(text1);
  const ids2 = extractPropertyIdentifiers(text2);
  
  const conflict = hasConflictingIdentifiers(ids1, ids2);
  const strong = hasMatchingStrongIdentifiers(ids1, ids2);
  
  const core1 = extractCoreIdentity(text1);
  const core2 = extractCoreIdentity(text2);
  const bigrams1 = getBigrams(core1);
  const bigrams2 = getBigrams(core2);
  const coreSim = jaccardSimilarity(bigrams1, bigrams2);
  const ovSim = overlapSimilarity(bigrams1, bigrams2);
  
  const nums1 = getNumberTokens(text1);
  const nums2 = getNumberTokens(text2);
  const commonNums = nums1.filter(n => nums2.includes(n));
  
  let matched = false;
  if (conflict) {
    matched = false;
  } else if (strong) {
    matched = true;
  } else if (coreSim >= 0.8) {
    matched = true;
  } else if (nums1.length > 0 && nums2.length > 0 && coreSim >= 0.55 && commonNums.length > 0) {
    matched = true;
  } else if (nums1.length > 0 && nums2.length > 0 && ovSim >= 0.85 && commonNums.length >= 1) {
    matched = true;
  } else if (ids1.houseNumber && ids1.houseNumber === ids2.houseNumber && ovSim >= 0.60) {
    matched = true;
  }
  
  console.log(`Matched: ${matched} | Conflict: ${conflict} | CoreSim: ${coreSim.toFixed(3)} | OverlapSim: ${ovSim.toFixed(3)}`);
  return matched;
}

// Case 1
const c1_text1 = "Quyền sử dụng đất và quyền sở hữu nhà ở số 186/32 Trần Quang Khải, phường Tân Định, Quận 1 (nay là phường Tân Định), Thành phố Hồ Chí Minh.";
const c1_text2 = "Quyền sử dụng đất thửa đất số 67, tờ bản đồ số 51 tọa lạc 186/32 Trần Quang Khải, P.Tân Định, Quận 1, TPHCM.";
const case1Matched = runTest("Case 1 (186/32 Trần Quang Khải)", c1_text1, c1_text2);

// Case 2
const c2_textA = "QSDĐ và tài sản khác gắn liền với đất tọa lạc tại địa chỉ: 253 đường Liên tỉnh 5, phường 5, Quận 8, Thành phố Hồ Chí Minh thuộc thửa đất số 41, tờ bản đồ số 100 (Diện tích đất thực tế:367,5m2, theo GCN: 371,7m2 ; nhà diện tích sàn xây dựng: thực tế: 222,2m2; theo GCN:161,3m2).";
const c2_textB = "Nhà đất số 253 đường Liên tỉnh 5 (Quốc lộ 50), phường Bình Đông (trước đây là Phường 5, Quận 8), Thành phố Hồ Chí Minh.";
const c2_textC = "Nhà đất số 253 đường Liên tỉnh 5 (Quốc lộ 50), Phường 5, Quận 8 (nay là phường Bình Đông), Thành phố Hồ Chí Minh.";

const case2ABMatched = runTest("Case 2 (A vs B)", c2_textA, c2_textB);
const case2BCMatched = runTest("Case 2 (B vs C)", c2_textB, c2_textC);
const case2ACMatched = runTest("Case 2 (A vs C)", c2_textA, c2_textC);

console.log("\nSUMMARY:");
console.log("Case 1 Matched:", case1Matched);
console.log("Case 2 A-B Matched:", case2ABMatched);
console.log("Case 2 B-C Matched:", case2BCMatched);
console.log("Case 2 A-C Matched:", case2ACMatched);
