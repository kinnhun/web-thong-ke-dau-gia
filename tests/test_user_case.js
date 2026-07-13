const { 
  extractPropertyIdentifiers, 
  removeDiacritics, 
  extractCoreIdentity, 
  hasMatchingStrongIdentifiers, 
  hasConflictingIdentifiers,
  getBigrams,
  jaccardSimilarity,
  overlapSimilarity,
  getNumberTokens
} = require('./bot-crawls-data/src/utils/helpers');

const text1 = `Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh được UBND Quận 1 cấp Giấy chứng nhận quyền sử dụng đất số AG 245065 ngày 30/10/2006. Gồm: a) Quyền sử dụng đất ở: - Thửa đất số 22, tờ bản đồ số 17. - Địa chỉ thửa đất: số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh. - Diện tích: 553,1m2. - Hình thức sử dụng: + Sử dụng riêng: 5,6m2 + Sử dụng chung: 267,0m2. - Mục đích sử dụng đất: Đất ở tại đô thị. - Thời hạn sử dụng đất: Lâu dài. - Nguồn gốc sử dụng đất: Nhà nước công nhận quyền sử dụng đất như Nhà nước giao đất có thu tiền sử dụng đất. b) Tài sản gắn liền với đất: Một phần biệt thự 3 tầng, diện tích xây dựng 133,89m2; kết cấu: tường gạch, sàn BTCT. Căn hộ ở tầng 1 + 2, diện tích sử dụng riêng: 59,93m2, diện tích sử dụng chung: 27,25m2 (phân bổ: 6,67m2). c) Ghi chú: - Lộ giới đường Lê Văn Hưu: 20,0m (10,0m + 10,0m) - Căn hộ thuộc một phần thửa 22, phần diện tích 280,5m2 còn lại thuộc các hộ khác sử dụng. d) Tại thời điểm kê biên tài sản, có diện tích xây dựng phát sinh ngoài diện tích được cấp Giấy chứng nhận quyền sử dụng đất. Phần xây dựng thêm này không được bán đấu giá và chủ sở hữu phần tài sản xây dựng thêm này đồng ý tự nguyện tháo dỡ để trả lại hiện trạng tài sản khi bán đấu giá thành và giao tài sản cho người mua được tài sản đấu giá. Chi phí phát sinh liên quan đến việc tháo dỡ này do chủ sở hữu phần xây dựng thêm chịu. (Thông tin tài sản theo Biên bản về việc kê biên, xử lý tài sản vào lúc 08 giờ 30 phút ngày 16 tháng 01 năm 2024 của Chi cục Thi hành án dân sự Quận 1).`;

const text2 = `Nhà ở và quyền sử dụng đất ở tại thửa đất số 22, tờ bản đồ số 17; địa chỉ thửa đất: 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh.`;

const ids1 = extractPropertyIdentifiers(text1);
const ids2 = extractPropertyIdentifiers(text2);

console.log('--- Identifiers 1 ---');
console.log(JSON.stringify(ids1, null, 2));
console.log('--- Identifiers 2 ---');
console.log(JSON.stringify(ids2, null, 2));

console.log('\n--- Comparisons ---');
console.log('Has Conflict:', hasConflictingIdentifiers(ids1, ids2));
console.log('Is Strong Match:', hasMatchingStrongIdentifiers(ids1, ids2));

const core1 = extractCoreIdentity(text1);
const core2 = extractCoreIdentity(text2);
const bigrams1 = getBigrams(core1);
const bigrams2 = getBigrams(core2);
const coreSim = jaccardSimilarity(bigrams1, bigrams2);
const ovSim = overlapSimilarity(bigrams1, bigrams2);

console.log('\nCore 1:', core1);
console.log('Core 2:', core2);
console.log('Core Similarity:', coreSim);
console.log('Overlap Similarity:', ovSim);

const nums1 = getNumberTokens(text1);
const nums2 = getNumberTokens(text2);
const commonNums = nums1.filter(n => nums2.includes(n));

console.log('\nNum Tokens 1 (count):', nums1.length);
console.log('Num Tokens 2:', nums2);
console.log('Common Num Tokens:', commonNums);

// Simulate the search logic in detail.scraper.js
console.log('\n--- Simulation of detail.scraper.js matching logic ---');
let matched = false;
if (hasConflictingIdentifiers(ids1, ids2)) {
    console.log('REJECTED: Conflicting identifiers');
} else if (hasMatchingStrongIdentifiers(ids1, ids2)) {
    console.log('MATCHED: Strong identifiers match');
    matched = true;
} else if (coreSim >= 0.8) {
    console.log('MATCHED: High core similarity');
    matched = true;
} else if (nums1.length > 0 && nums2.length > 0 && coreSim >= 0.55 && commonNums.length > 0) {
    console.log('MATCHED: Medium core similarity + common numbers');
    matched = true;
} else if (nums1.length > 0 && nums2.length > 0 && ovSim >= 0.85 && commonNums.length >= 1) {
    console.log('MATCHED: High overlap similarity + common numbers');
    matched = true;
} else {
    console.log('NOT MATCHED');
}
