const { extractCoreIdentity, getBigrams, jaccardSimilarity, getNumberTokens } = require('./bot-crawls-data/src/utils/helpers');

function matchV2(nameA, nameB) {
  const coreA = extractCoreIdentity(nameA);
  const coreB = extractCoreIdentity(nameB);
  const numbersA = getNumberTokens(nameA);
  const numbersB = getNumberTokens(nameB);
  const coreSim = jaccardSimilarity(getBigrams(coreA), getBigrams(coreB));
  
  const bothHave = numbersA.length > 0 && numbersB.length > 0;
  const neitherHas = numbersA.length === 0 && numbersB.length === 0;
  let common = [];
  if (bothHave) {
    common = numbersA.filter(t => numbersB.includes(t));
    if (common.length === 0) return { result: "REJECT (số khác nhau)", coreSim, coreA, coreB, numbersA, numbersB };
  }
  
  // Trên core identity đã sạch, ngưỡng thấp hơn vẫn an toàn
  if (coreSim >= 0.80) return { result: "MATCH (core>=80%)", coreSim, coreA, coreB, numbersA, numbersB };
  if (common.length > 0 && coreSim >= 0.60) return { result: "MATCH (số chung + core>=60%)", coreSim, coreA, coreB, numbersA, numbersB };
  return { result: `NO MATCH (core=${(coreSim*100).toFixed(1)}%)`, coreSim, coreA, coreB, numbersA, numbersB };
}

const cases = [
  { label: "1: Cùng 241/13, khác ngoặc", a: "Nhà đất số 241/13 Lê Đình Cẩn, khu phố 5, phường Tân Tạo, quận Bình Tân, Thành phố Hồ Chí Minh", b: "Nhà đất số 241/13 Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân (nay là phường Tân Tạo), Thành phố Hồ Chí Minh", exp: "MATCH" },
  { label: "2: 527 vs 15, cùng P4", a: "Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 527 Hoàng Văn Thụ, Phường 4, quận Tân Bình, Thành phố Hồ Chí Minh", b: "Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 15 Hậu Giang, Phường 4, quận Tân Bình, Thành phố Hồ Chí Minh", exp: "NO" },
  { label: "3: 241/13 vs 156/11", a: "Nhà đất số 241/13 Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, TP HCM", b: "Quyền sở hữu nhà ở tại địa chỉ số 156/11 Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, TP HCM", exp: "NO" },
  { label: "4: 12-16 Lê Quang Sung", a: "Quyền sử dụng đất và tài sản gắn liền với đất tại địa chỉ: số 12-16 Lê Quang Sung, Phường 2, Quận 6, Thành phố Hồ Chí Minh", b: "Quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất tại địa chỉ: số 12-16 Lê Quang Sung, Phường 2, Quận 6, Thành phố Hồ Chí Minh", exp: "MATCH" },
  { label: "5: Thêm (Lần 2)", a: "Quyền sử dụng đất tại thửa 123, xã An Bình, huyện Bình Dương", b: "Quyền sử dụng đất tại thửa 123, xã An Bình, huyện Bình Dương (Lần 2)", exp: "MATCH" },
  { label: "6: Ngày + tên ngắn", a: "Ngày 10/2 đăng bán nhà căn hộ số 2/01 phường 5 quận 3", b: "Đăng bán căn nhà số 2/01 phường 5 quận 3", exp: "MATCH" },
  { label: "7: Không số, cùng xã", a: "Quyền sử dụng đất và tài sản gắn liền với đất tại xã Tân Hiệp, huyện Hóc Môn, Thành phố Hồ Chí Minh", b: "Quyền sử dụng đất và tài sản gắn liền với đất tại xã Tân Hiệp, huyện Hóc Môn, TP Hồ Chí Minh", exp: "MATCH" },
  { label: "8: Không số, KHÁC xã", a: "Quyền sử dụng đất và tài sản gắn liền với đất tại xã Tân Hiệp, huyện Hóc Môn, Thành phố Hồ Chí Minh", b: "Quyền sử dụng đất và tài sản gắn liền với đất tại xã Tân Xuân, huyện Hóc Môn, Thành phố Hồ Chí Minh", exp: "NO" },
  { label: "9: Xe, biển số khác", a: "Xe ô tô biển số 51G-12345 nhãn hiệu Toyota", b: "Xe ô tô biển số 51G-67890 nhãn hiệu Toyota", exp: "NO" },
  { label: "10: Cùng thửa 123, khác tờ BĐ", a: "Quyền sử dụng đất tại thửa đất số 123, tờ bản đồ số 15, xã An Bình, huyện Dĩ An, Bình Dương", b: "Quyền sử dụng đất tại thửa đất số 123, tờ bản đồ số 20, xã An Bình, huyện Dĩ An, Bình Dương", exp: "NO" },
  { label: "11: 241/13A vs 241/13B", a: "Nhà đất số 241/13A Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, TP HCM", b: "Nhà đất số 241/13B Lê Đình Cẩn, phường Tân Tạo, quận Bình Tân, TP HCM", exp: "NO" },
  { label: "12: Giống hệt", a: "01 lô đất tại xã An Bình", b: "01 lô đất tại xã An Bình", exp: "MATCH" },
  { label: "13: 241/13 3 bài khác ngoặc (1 vs 3)", a: "Nhà đất số 241/13 Lê Đình Cẩn, khu phố 5, phường Tân Tạo, quận Bình Tân, Thành phố Hồ Chí Minh", b: "Nhà đất số 241/13 Lê Đình Cẩn, phường Tân Tạo (trước đây là phường Tân Tạo, quận Bình Tân), Thành phố Hồ Chí Minh", exp: "MATCH" },
];

let passed = 0, failed = 0;
console.log("=".repeat(100));
console.log("TEST THUẬT TOÁN V2 — CORE IDENTITY EXTRACTION");
console.log("=".repeat(100));
for (const c of cases) {
  const r = matchV2(c.a, c.b);
  const isMatch = r.result.startsWith("MATCH");
  const ok = isMatch === c.exp.startsWith("MATCH");
  if (ok) passed++; else failed++;
  console.log(`\n${"─".repeat(90)}`);
  console.log(`📌 CASE ${c.label}`);
  console.log(`  Core A: "${r.coreA}"`);
  console.log(`  Core B: "${r.coreB}"`);
  console.log(`  Nums: [${r.numbersA}] vs [${r.numbersB}] | Core Sim: ${(r.coreSim*100).toFixed(1)}%`);
  console.log(`  🔎 ${r.result}  |  Kỳ vọng: ${c.exp}`);
  console.log(`  ${ok ? "✅ ĐÚNG" : "❌ SAI"}`);
}
console.log(`\n${"=".repeat(100)}`);
console.log(`KẾT QUẢ: ${passed}/${cases.length} ĐÚNG, ${failed} SAI`);
