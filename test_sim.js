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

const n7 = "Quyền sử dụng đất tại xã Bình Phú, huyện Thạch Thất";
const n8 = "Quyền sử dụng đất tại xã Bình Yên, huyện Thạch Thất";
console.log("Sim n7 & n8:", jaccardSimilarity(getBigrams(n7), getBigrams(n8)));
