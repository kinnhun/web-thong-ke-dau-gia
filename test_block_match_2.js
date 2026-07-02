const { removeDiacritics } = require('./bot-crawls-data/src/utils/helpers');

const text1 = "Toàn bộ 18 khoản nợ được đảm bảo bằng quyền tài sản tại Dự án KCN Phong Phú.";
const s = removeDiacritics(text1.toLowerCase());
console.log("s:", s);

const blockRegex = /(?:toa\s*nha|toa|block|thap|tower|building)\s*[:\.]?\s*([a-z0-9]+)/i;
const match = s.match(blockRegex);
console.log("Match:", match);
