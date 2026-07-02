const { extractCoreIdentity, getBigrams, jaccardSimilarity, overlapSimilarity } = require('../src/utils/helpers');

const names = [
  "06 xe mô tô gắn máy các loại hai bánh đã qua sử dụng",
  "06 xe ô tô các loại – bán từng xe (Chi tiết tại file đính kèm).",
  "(MS186/21)06 Xe nâng diesel nhãn hiệu Toyota model 02-7FD15 (Bán nguyên lô không tách rời).",
  "06 Xe Nâng hiệu TOYOTA",
  "Đấu giá chung lô 06 xe ô tô"
];

for (let i = 0; i < names.length; i++) {
  const coreI = extractCoreIdentity(names[i]);
  const bigramsI = getBigrams(coreI);
  console.log(`\nName ${i}: ${names[i]}`);
  console.log(`Core: "${coreI}"`);
  
  for (let j = i + 1; j < names.length; j++) {
    const coreJ = extractCoreIdentity(names[j]);
    const bigramsJ = getBigrams(coreJ);
    const sim = jaccardSimilarity(bigramsI, bigramsJ);
    const overlap = overlapSimilarity(bigramsI, bigramsJ);
    console.log(`  -> vs Name ${j} ("${coreJ}"): Jaccard = ${sim.toFixed(4)}, Overlap = ${overlap.toFixed(4)}`);
  }
}
