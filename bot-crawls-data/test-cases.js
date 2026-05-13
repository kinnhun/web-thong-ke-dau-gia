const {
  extractCoreIdentity,
  extractPropertyIdentifiers,
  hasConflictingIdentifiers,
  hasMatchingStrongIdentifiers,
  getNumberTokens,
  jaccardSimilarity,
  overlapSimilarity,
  getBigrams
} = require('./src/utils/helpers');

const tests = [
  {
    name1: "Quyền sử dụng đất tại thửa đất số 2207, tờ bản đồ số 3, phường An Phú, Quận 2 (nay là Thành phố Thủ Đức), Thành phố Hồ Chí Minh",
    name2: "Quyền sử dụng đất tại thửa đất số 2207, tờ bản đồ số 3, phường An Phú, Quận 2 (nay là phường Bình Trưng), Thành phố Hồ Chí Minh",
    expectedMatch: true,
    desc: "Cùng thửa/tờ, khác tên phường do đổi tên hành chính"
  },
  {
    name1: "Quyền sử dụng đất tại thửa đất số 01, tờ bản đồ số 3, phường An Phú",
    name2: "Quyền sử dụng đất tại thửa đất số 02, tờ bản đồ số 3, phường An Phú",
    expectedMatch: false,
    desc: "Chống nhận diện nhầm: Cùng địa chỉ, nhưng khác số thửa"
  },
  {
    name1: "Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 490 Gia Phú, Phường 3 (nay là Phường 1), Quận 6, Thành phố Hồ Chí Minh.",
    name2: "Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 490 Gia Phú, Phường 3, Quận 6 (nay là phường Bình Tiên), Thành phố Hồ Chí Minh.",
    expectedMatch: true,
    desc: "Đổi tên hành chính trong ngoặc (nay là...)"
  },
  {
    name1: "Xe ô tô con nhãn hiệu Toyota Camry, biển kiểm soát 30A-123.45, số khung 123456789, số máy 987654321",
    name2: "Xe ô tô Toyota Camry, biển số 30A12345",
    expectedMatch: true,
    desc: "Phương tiện: Định dạng biển số xe khác nhau (có/không có dấu gạch ngang)"
  },
  {
    name1: "Xe ô tô con nhãn hiệu Toyota Camry, biển số 30A-123.45",
    name2: "Xe ô tô con nhãn hiệu Toyota Camry, biển số 30A-123.46",
    expectedMatch: false,
    desc: "Chống nhận diện nhầm: Phương tiện khác biển số"
  },
  {
    name1: "Căn hộ số 12A, tầng 12, Tòa nhà Landmark 81, Vinhomes Central Park",
    name2: "Căn hộ 12A, chung cư Landmark 81",
    expectedMatch: true,
    desc: "Căn hộ chung cư: Rút gọn từ ngữ (Tòa nhà vs Chung cư)"
  },
  {
    name1: "Căn hộ số 12A, tầng 12, Tòa nhà Landmark 81, Vinhomes Central Park",
    name2: "Căn hộ số 12B, tầng 12, Tòa nhà Landmark 81, Vinhomes Central Park",
    expectedMatch: false,
    desc: "Chống nhận diện nhầm: Cùng chung cư, khác mã căn hộ"
  },
  {
    name1: "Tài sản thanh lý: Lô đất 500m2 theo Giấy chứng nhận quyền sử dụng đất số CS 12345 do Sở TNMT cấp",
    name2: "Lô đất 500m2 (Sổ đỏ số CS12345)",
    expectedMatch: true,
    desc: "Pháp lý: Viết tắt Giấy chứng nhận thành Sổ đỏ và format mã số"
  },
  {
    name1: `Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh được UBND Quận 1 cấp Giấy chứng nhận quyền sử dụng đất số AG 245065 ngày 30/10/2006. Gồm: a) Quyền sử dụng đất ở: - Thửa đất số 22, tờ bản đồ số 17. - Địa chỉ thửa đất: số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh. - Diện tích: 553,1m2.`,
    name2: `Nhà ở và quyền sử dụng đất ở tại thửa đất số 22, tờ bản đồ số 17; địa chỉ thửa đất: 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh.`,
    expectedMatch: true,
    desc: "Trường hợp User cung cấp: Một cái rất dài (kê biên) và một cái ngắn gọn"
  },
  {
    name1: "Dây chuyền sản xuất bao bì, model 2023, số hiệu PK-123456",
    name2: "Máy làm bao bì PK123456",
    expectedMatch: true,
    desc: "Máy móc: Khớp theo số hiệu/model"
  },
  {
    name1: "1.000.000 cổ phần của Công ty CP ABC, MST 0101234567",
    name2: "Cổ phần Công ty ABC (MST: 0101234567)",
    expectedMatch: true,
    desc: "Cổ phần/Doanh nghiệp: Khớp theo mã số thuế"
  },
  {
      name1: "Quyền sử dụng đất tại thửa đất 100, tờ bản đồ 20, diện tích 150m2",
      name2: "Thửa đất 100, tờ bản đồ 20, diện tích 200m2",
      expectedMatch: false,
      desc: "Chống nhận diện nhầm: Cùng thửa/tờ nhưng diện tích lệch quá nhiều (150m2 vs 200m2)"
  }
];

console.log("=== KẾT QUẢ KIỂM TRA LOGIC DUPLICATE (MÔ PHỎNG PRODUCTION) ===");
let allPassed = true;

for (let i = 0; i < tests.length; i++) {
  const { name1, name2, expectedMatch, desc } = tests[i];
  
  const targetIdentifiers = extractPropertyIdentifiers(name1);
  const candidateIdentifiers = extractPropertyIdentifiers(name2);
  const targetNumbers = getNumberTokens(name1);
  const candidateNumbers = getNumberTokens(name2);
  
  const targetCore = extractCoreIdentity(name1);
  const targetCoreBigrams = getBigrams(targetCore);
  const candidateCore = extractCoreIdentity(name2);
  const candidateCoreBigrams = getBigrams(candidateCore);
  
  const coreSim = jaccardSimilarity(targetCoreBigrams, candidateCoreBigrams);
  const ovSim = overlapSimilarity(targetCoreBigrams, candidateCoreBigrams);
  const commonNumbers = targetNumbers.filter(t => candidateNumbers.includes(t));
  const bothHaveNumbers = targetNumbers.length > 0 && candidateNumbers.length > 0;

  // LOGIC GIỐNG TRONG searchDuplicatesByFuzzyName (detail.scraper.js)
  let match = false;
  let reason = "";

  if (hasConflictingIdentifiers(targetIdentifiers, candidateIdentifiers)) {
    match = false;
    reason = "Xung đột định danh (Plot/Map/Area...)";
  } else if (hasMatchingStrongIdentifiers(targetIdentifiers, candidateIdentifiers)) {
    match = true;
    reason = "Khớp định danh mạnh (Plot+Map, BKS, GCN...)";
  } else if (coreSim >= 0.80) {
    match = true;
    reason = "Tương đồng Core Identity cao (>=80%)";
  } else if (bothHaveNumbers && coreSim >= 0.55 && commonNumbers.length > 0) {
    match = true;
    reason = "Core Sim >= 55% + Có số chung";
  } else if (bothHaveNumbers && ovSim >= 0.85 && commonNumbers.length >= 1) {
    match = true;
    reason = "Overlap Sim >= 85% + Có số chung";
  } else if (targetIdentifiers.apartment && targetIdentifiers.apartment === candidateIdentifiers.apartment && (coreSim >= 0.20 || ovSim >= 0.33)) {
    match = true;
    reason = "Cùng số căn hộ + Tương đồng >= 33%";
  } else if (targetIdentifiers.houseNumber && targetIdentifiers.houseNumber === candidateIdentifiers.houseNumber && ovSim >= 0.60) {
    match = true;
    reason = "Cùng số nhà + Overlap Sim >= 60%";
  }

  const passed = match === expectedMatch;
  if (!passed) allPassed = false;
  
  console.log(`\nTest case ${i + 1}: ${passed ? '✅ PASSED' : '❌ FAILED'} - ${desc || ''}`);
  console.log(`- Ident 1: ${JSON.stringify(targetIdentifiers)}`);
  console.log(`- Ident 2: ${JSON.stringify(candidateIdentifiers)}`);
  console.log(`- Core Sim: ${(coreSim * 100).toFixed(2)}%, Overlap: ${(ovSim * 100).toFixed(2)}%`);
  console.log(`- Common Nums: ${commonNumbers.join(', ') || 'None'}`);
  console.log(`=> Result: ${match ? 'MATCHED' : 'NOT MATCHED'} (${reason || 'No match criteria met'})`);
  if (!passed) {
      console.log(`   EXPECTED: ${expectedMatch ? 'MATCH' : 'NO MATCH'}`);
  }
}

console.log(`\n=== TỔNG KẾT: ${allPassed ? 'Tất cả Test Case Đều Đúng! 🎉' : 'Có Test Case Bị Sai! ⚠️'} ===`);
if (!allPassed) process.exit(1);
