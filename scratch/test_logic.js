const h = require('../bot-crawls-data/src/utils/helpers.js');

const name1 = "Quyền sở hữu nhà ở và quyền sử dụng đất ở tại số 460/60 Nguyễn Tất Thành, Phường 18, Quận 4, Thành phố Hồ Chí Minh.";
const name2 = "Quyền sở hữu nhà ở và quyền sử dụng đất ở tại số 460/60 Nguyễn Tất Thành, Phường 18, Quận 4 (nay là phường Xóm Chiếu), Thành phố Hồ Chí Minh.";

console.log('--- extractCoreIdentity ---');
console.log('Name 1:', h.extractCoreIdentity(name1));
console.log('Name 2:', h.extractCoreIdentity(name2));

console.log('\n--- getNumberTokens ---');
console.log('Name 1:', h.getNumberTokens(name1));
console.log('Name 2:', h.getNumberTokens(name2));

const t1 = h.extractCoreIdentity(name1);
const t2 = h.extractCoreIdentity(name2);
const b1 = h.getBigrams(t1);
const b2 = h.getBigrams(t2);

console.log('\n--- Similarity ---');
console.log('Jaccard:', h.jaccardSimilarity(b1, b2));
console.log('Overlap:', h.overlapSimilarity(b1, b2));
