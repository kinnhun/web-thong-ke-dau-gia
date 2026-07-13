function getBigrams(text) {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\d]/gi, '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const bigrams = new Set();
  if (words.length === 0) return bigrams;
  if (words.length === 1) {
    bigrams.add(words[0]);
    return bigrams;
  }
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

function jaccardSimilarity(set1, set2) {
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;
  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

function getNumberTokens(str) {
  const tokens = str.toLowerCase().match(/[\w/\\-]*\d+[\w/\\-]*/g) || [];
  return [...new Set(tokens)];
}

function isSameProperty(name1, name2) {
  const b1 = getBigrams(name1);
  const b2 = getBigrams(name2);
  const sim = jaccardSimilarity(b1, b2);

  const t1 = getNumberTokens(name1);
  const t2 = getNumberTokens(name2);

  let hasCommonNumber = false;
  let hasNumbers = t1.length > 0 && t2.length > 0;
  
  if (hasNumbers) {
    const common = t1.filter(t => t2.includes(t));
    if (common.length === 0) return false;
    hasCommonNumber = true;
  }

  if (sim >= 0.90) return true;

  if (sim >= 0.65) {
     if (hasCommonNumber) return true;
     if (!hasNumbers && sim >= 0.80) return true;
  }

  return false;
}

const n1 = "Nhà đất số 241/13 Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân (nay là phường Tân Tạo), Thành phố Hồ Chí Minh";
const n2 = "Quyền sở hữu nhà ở và quyền sử dụng đất ở tại địa chỉ số 156/11 Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, Thành phố Hồ Chí Minh";
console.log("n1 & n2 MATCH?", isSameProperty(n1, n2)); // false

const n3 = "12-16 Lê Quang Sung";
const n4 = "12-16 Lê Quang Sung, P2";
console.log("n3 & n4 MATCH?", isSameProperty(n3, n4)); // true

const n5 = "Quyền sử dụng đất tại xã Bình Phú, huyện Thạch Thất";
const n6 = "Quyền sử dụng đất ở tại xã Bình Phú, Thạch Thất";
console.log("n5 & n6 MATCH?", isSameProperty(n5, n6)); // true (no numbers, high sim)
