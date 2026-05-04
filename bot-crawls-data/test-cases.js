const {
  extractCoreIdentity,
  extractPropertyIdentifiers,
  hasConflictingIdentifiers,
  hasMatchingStrongIdentifiers,
  getNumberTokens,
  jaccardSimilarity,
  getBigrams
} = require('./src/utils/helpers');

const tests = [
  {
    name1: "Quyền sử dụng đất tại thửa đất số 2207, tờ bản đồ số 3, phường An Phú, Quận 2 (nay là Thành phố Thủ Đức), Thành phố Hồ Chí Minh",
    name2: "Quyền sử dụng đất tại thửa đất số 2207, tờ bản đồ số 3, phường An Phú, Quận 2 (nay là phường Bình Trưng), Thành phố Hồ Chí Minh",
    expectedMatch: true
  },
  {
    name1: "Quyền sử dụng đất tại thửa đất số 2207, tờ bản đồ số 3, phường An Phú, Quận 2 (nay là phường An Khánh), Thành phố Hồ Chí Minh",
    name2: "Quyền sử dụng đất tại thửa đất số 2207, tờ bản đồ số 3, phường An Phú, Quận 2 (nay là Thành phố Thủ Đức), Thành phố Hồ Chí Minh",
    expectedMatch: true
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
  }
];

console.log("=== KẾT QUẢ KIỂM TRA LOGIC DUPLICATE ===");
let allPassed = true;

for (let i = 0; i < tests.length; i++) {
  const { name1, name2, expectedMatch, desc } = tests[i];
  
  const id1 = extractPropertyIdentifiers(name1);
  const id2 = extractPropertyIdentifiers(name2);
  const conflict = hasConflictingIdentifiers(id1, id2);
  const strongMatch = hasMatchingStrongIdentifiers(id1, id2);
  
  const core1 = extractCoreIdentity(name1);
  const core2 = extractCoreIdentity(name2);
  const sim = jaccardSimilarity(getBigrams(core1), getBigrams(core2));
  
  const nums1 = getNumberTokens(name1);
  const nums2 = getNumberTokens(name2);
  const bothHaveNumbers = nums1.length > 0 && nums2.length > 0;
  const commonNums = nums1.filter(t => nums2.includes(t));
  
  let match = false;
  if (conflict) {
    match = false;
  } else if (strongMatch) {
    match = true;
  } else if (bothHaveNumbers && commonNums.length === 0) {
    match = false;
  } else if (sim >= 0.80) {
    match = true;
  } else if (bothHaveNumbers && sim >= 0.60 && commonNums.length > 0) {
    match = true;
  } else if (id1.apartment && id1.apartment === id2.apartment && commonNums.length >= 2 && sim >= 0.05) {
    match = true; // Cùng căn hộ và cùng chung cư (chung ít nhất 2 số, VD: 12A và 81)
  }
  
  const passed = match === expectedMatch;
  if (!passed) allPassed = false;
  
  console.log(`\\nTest case ${i + 1}: ${passed ? '✅ PASSED' : '❌ FAILED'} - ${desc || ''}`);
  console.log(`- Tài sản 1: ${name1}`);
  console.log(`- Tài sản 2: ${name2}`);
  console.log(`- Xung đột định danh (Plot, Map...): ${conflict}`);
  console.log(`- Định danh MẠNH khớp 100%: ${strongMatch}`);
  console.log(`- Số trích xuất chung: ${commonNums.join(', ') || 'Không có'}`);
  console.log(`- Độ tương đồng Jaccard (Core Sim): ${(sim * 100).toFixed(2)}%`);
  console.log(`=> Kết quả: ${match ? 'LÀ TRÙNG LẶP' : 'KHÔNG TRÙNG LẶP'} (Kỳ vọng: ${expectedMatch ? 'TRÙNG LẶP' : 'KHÔNG TRÙNG LẶP'})`);
}

console.log(`\\n=== TỔNG KẾT: ${allPassed ? 'Tất cả Test Case Đều Đúng! 🎉' : 'Có Test Case Bị Sai! ⚠️'} ===`);
