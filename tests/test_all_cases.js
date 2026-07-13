const { getBigrams, jaccardSimilarity } = require('./bot-crawls-data/src/utils/helpers');

const removeDiacritics = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

const getNumberTokens = (str) => {
  let s = removeDiacritics(str.toLowerCase());
  s = s.replace(/\b(ngay|thang|nam)\s*\d+([\/\-]\d+)*\b/g, '');
  s = s.replace(/\b(19\d{2}|20\d{2})\b/g, '');
  s = s.replace(/\b(phuong|quan|p|q|to|khu pho|kp|ap|thon)[\s\.\,\-]*\d+\b/g, '');
  const tokens = s.match(/[\w/\\-]*\d+[\w/\\-]*/g) || [];
  return [...new Set(tokens)];
};

function matchAlgorithm(nameA, nameB) {
  const numbersA = getNumberTokens(nameA);
  const numbersB = getNumberTokens(nameB);
  const bigramsA = getBigrams(nameA);
  const bigramsB = getBigrams(nameB);
  const sim = jaccardSimilarity(bigramsA, bigramsB);

  const bothHaveNumbers = numbersA.length > 0 && numbersB.length > 0;
  const neitherHasNumbers = numbersA.length === 0 && numbersB.length === 0;
  let commonNumbers = [];
  let hasDifferentNumbers = false;

  if (bothHaveNumbers) {
    commonNumbers = numbersA.filter(t => numbersB.includes(t));
    if (commonNumbers.length === 0) return { result: "REJECT (QT1: khác số)", sim, numbersA, numbersB, commonNumbers };
    const commonSet = new Set(commonNumbers);
    hasDifferentNumbers = numbersA.some(n => !commonSet.has(n)) || numbersB.some(n => !commonSet.has(n));
  }

  if (sim >= 0.90) return { result: "MATCH (QT2: sim>=90%)", sim, numbersA, numbersB, commonNumbers };
  if (neitherHasNumbers) return { result: "REJECT (QT3-4: ko số, sim<90%)", sim, numbersA, numbersB, commonNumbers };
  if (commonNumbers.length > 0 && !hasDifferentNumbers && sim >= 0.72) return { result: "MATCH (QT5: số chung sạch, sim>=72%)", sim, numbersA, numbersB, commonNumbers };
  if (commonNumbers.length > 0 && hasDifferentNumbers && sim >= 0.85) return { result: "MATCH (QT6: số chung + khác, sim>=85%)", sim, numbersA, numbersB, commonNumbers };
  if (!bothHaveNumbers && !neitherHasNumbers && sim >= 0.85) return { result: "MATCH (1 bên có số, sim>=85%)", sim, numbersA, numbersB, commonNumbers };

  return { result: `NO MATCH (sim=${(sim*100).toFixed(1)}%)`, sim, numbersA, numbersB, commonNumbers };
}

const cases = [
  { label: "CASE 1: Cùng TS, khác ngoặc đơn (241/13)", a: "Nhà đất số 241/13 Lê Đình Cẩn, khu phố 5, phường Tân Tạo, quận Bình Tân, Thành phố Hồ Chí Minh", b: "Nhà đất số 241/13 Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân (nay là phường Tân Tạo), Thành phố Hồ Chí Minh", expected: "MATCH" },
  { label: "CASE 2: Khác số nhà (527 vs 15, cùng Phường 4)", a: "Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 527 Hoàng Văn Thụ, Phường 4, quận Tân Bình, Thành phố Hồ Chí Minh", b: "Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 15 Hậu Giang, Phường 4, quận Tân Bình, Thành phố Hồ Chí Minh", expected: "NO MATCH" },
  { label: "CASE 3: Cùng đường, khác số nhà (241/13 vs 156/11)", a: "Nhà đất số 241/13 Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, TP HCM", b: "Quyền sở hữu nhà ở tại địa chỉ số 156/11 Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, TP HCM", expected: "NO MATCH" },
  { label: "CASE 4: Cùng TS 12-16 Lê Quang Sung", a: "Quyền sử dụng đất và tài sản gắn liền với đất tại địa chỉ: số 12-16 Lê Quang Sung, Phường 2, Quận 6, Thành phố Hồ Chí Minh", b: "Quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất tại địa chỉ: số 12-16 Lê Quang Sung, Phường 2, Quận 6, Thành phố Hồ Chí Minh", expected: "MATCH" },
  { label: "CASE 5: Cùng TS, thêm (Lần 2)", a: "Quyền sử dụng đất tại thửa 123, xã An Bình, huyện Bình Dương", b: "Quyền sử dụng đất tại thửa 123, xã An Bình, huyện Bình Dương (Lần 2)", expected: "MATCH" },
  { label: "CASE 6: Có ngày, tên ngắn", a: "Ngày 10/2 đăng bán nhà căn hộ số 2/01 phường 5 quận 3", b: "Đăng bán căn nhà số 2/01 phường 5 quận 3", expected: "MATCH (edge case khó)" },
  { label: "CASE 7: Không số, cùng xã (Tân Hiệp)", a: "Quyền sử dụng đất và tài sản gắn liền với đất tại xã Tân Hiệp, huyện Hóc Môn, Thành phố Hồ Chí Minh", b: "Quyền sử dụng đất và tài sản gắn liền với đất tại xã Tân Hiệp, huyện Hóc Môn, TP Hồ Chí Minh", expected: "MATCH" },
  { label: "CASE 8: Không số, KHÁC xã (Tân Hiệp vs Tân Xuân)", a: "Quyền sử dụng đất và tài sản gắn liền với đất tại xã Tân Hiệp, huyện Hóc Môn, Thành phố Hồ Chí Minh", b: "Quyền sử dụng đất và tài sản gắn liền với đất tại xã Tân Xuân, huyện Hóc Môn, Thành phố Hồ Chí Minh", expected: "NO MATCH" },
  { label: "CASE 9: Xe cộ, biển số khác", a: "Xe ô tô biển số 51G-12345 nhãn hiệu Toyota", b: "Xe ô tô biển số 51G-67890 nhãn hiệu Toyota", expected: "NO MATCH" },
  { label: "CASE 10: Cùng thửa 123, KHÁC tờ BĐ (15 vs 20)", a: "Quyền sử dụng đất tại thửa đất số 123, tờ bản đồ số 15, xã An Bình, huyện Dĩ An, Bình Dương", b: "Quyền sử dụng đất tại thửa đất số 123, tờ bản đồ số 20, xã An Bình, huyện Dĩ An, Bình Dương", expected: "NO MATCH" },
  { label: "CASE 11: Số nhà 241/13A vs 241/13B", a: "Nhà đất số 241/13A Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, TP HCM", b: "Nhà đất số 241/13B Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, TP HCM", expected: "NO MATCH" },
  { label: "CASE 12: Tên ngắn, giống hệt", a: "01 lô đất tại xã An Bình", b: "01 lô đất tại xã An Bình", expected: "MATCH" },
];

console.log("=".repeat(100));
console.log("KIỂM TRA THUẬT TOÁN MỚI (7 QUY TẮC) - TẤT CẢ EDGE CASES");
console.log("=".repeat(100));

let passed = 0, failed = 0;
for (const c of cases) {
  const r = matchAlgorithm(c.a, c.b);
  const isMatch = r.result.startsWith("MATCH");
  const expectedMatch = c.expected.startsWith("MATCH");
  const ok = isMatch === expectedMatch;
  if (ok) passed++; else failed++;
  
  console.log(`\n${"─".repeat(90)}`);
  console.log(`📌 ${c.label}`);
  console.log(`  Số A: [${r.numbersA.join(', ')}]  Số B: [${r.numbersB.join(', ')}]  Chung: [${r.commonNumbers.join(', ')}]`);
  console.log(`  Similarity: ${(r.sim * 100).toFixed(1)}%`);
  console.log(`  🔎 Kết quả:  ${r.result}`);
  console.log(`  ✅ Kỳ vọng:  ${c.expected}`);
  console.log(`  ${ok ? "✅ ĐÚNG" : "❌ SAI"}`);
}

console.log(`\n${"=".repeat(100)}`);
console.log(`KẾT QUẢ: ${passed}/${cases.length} ĐÚNG, ${failed} SAI`);
console.log("=".repeat(100));
