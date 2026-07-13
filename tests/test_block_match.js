const { extractPropertyIdentifiers } = require('./bot-crawls-data/src/utils/helpers');

const text1 = "Toàn bộ 18 khoản nợ được đảm bảo bằng quyền tài sản tại Dự án KCN Phong Phú.";
const text2 = "Bán đấu giá không tách rời toàn bộ 18 khoản nợ được đảm bảo bằng quyền tài sản tại Dự án KCN Phong Phú (tọa lạc tại xã Phong Phú, huyện Bình Chánh, Tp. HCM) theo nguyên trạng khoản nợ.";

console.log("text1 identifiers:", extractPropertyIdentifiers(text1));
console.log("text2 identifiers:", extractPropertyIdentifiers(text2));

const s1 = text1.toLowerCase();
const blockRegex = /(?:toa\s*nha|toa|block|thap|tower|building)\s*[:\.]?\s*([a-z0-9]+)/i;
const match = s1.match(blockRegex);
console.log("Match:", match);
