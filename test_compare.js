require('dotenv').config({ path: './bot-crawls-data/.env' });
const h = require('./bot-crawls-data/src/utils/helpers.js');

const name1 = "Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh được UBND Quận 1 cấp Giấy chứng nhận quyền sử dụng đất số AG 245065 ngày 30/10/2006";
const name2 = "Nhà ở và quyền sử dụng đất ở tại thửa đất số 22, tờ bản đồ số 17; địa chỉ thửa đất: 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1 (nay là phường Sài Gòn), Thành phố Hồ Chí Minh.";

const core1 = h.extractCoreIdentity(name1);
const core2 = h.extractCoreIdentity(name2);

console.log('Core 1:', core1);
console.log('Core 2:', core2);

const bigrams1 = h.getBigrams(core1);
const bigrams2 = h.getBigrams(core2);

console.log('Jaccard:', h.jaccardSimilarity(bigrams1, bigrams2));
console.log('Overlap:', h.overlapSimilarity(bigrams1, bigrams2));

const num1 = h.getNumberTokens(name1);
const num2 = h.getNumberTokens(name2);
console.log('Num1:', num1);
console.log('Num2:', num2);

const common = num1.filter(t => num2.includes(t));
console.log('Common num:', common);

console.log('Ident 1:', h.extractPropertyIdentifiers(name1));
console.log('Ident 2:', h.extractPropertyIdentifiers(name2));
