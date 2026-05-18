const { jaccardSimilarity, extractCoreIdentity, extractPropertyIdentifiers, getBigrams, overlapSimilarity, hasConflictingIdentifiers, hasMatchingStrongIdentifiers, getNumberTokens } = require('./src/utils/helpers');

const text1 = "Quyền sử dụng đất có diện tích 114,5m2 và nhà ở có diện tích xây dựng 72,2m2 thuộc thửa đất số 615 tờ bản đồ số 35 tọa lạc tại địa chỉ 55/5F ấp Trung Lân, xã Bà Điểm, huyện Hóc Môn, thành phố Hồ Chí Minh.";
const text2 = "Quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất tại số 55/5F ấp Trung Lân, xã Bà Điểm, huyện Hóc Môn (nay là xã Bà Điểm), Thành phố Hồ Chí Minh.";

const core1 = extractCoreIdentity(text1);
const core2 = extractCoreIdentity(text2);
const set1 = getBigrams(core1);
const set2 = getBigrams(core2);

console.log("Core 1:", core1);
console.log("Core 2:", core2);
console.log("Jaccard Similarity:", jaccardSimilarity(set1, set2));
console.log("Overlap Similarity:", overlapSimilarity(set1, set2));
console.log("Identifiers 1:", extractPropertyIdentifiers(text1));
console.log("Tokens 1:", getNumberTokens(text1));
console.log("Tokens 2:", getNumberTokens(text2));
console.log("Has Matching Strong Identifiers:", hasMatchingStrongIdentifiers(extractPropertyIdentifiers(text1), extractPropertyIdentifiers(text2)));
console.log("Identifiers 1:", extractPropertyIdentifiers(text1));
console.log("Identifiers 2:", extractPropertyIdentifiers(text2));
