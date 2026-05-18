const { jaccardSimilarity, extractCoreIdentity, extractPropertyIdentifiers, getBigrams, overlapSimilarity, hasConflictingIdentifiers, hasMatchingStrongIdentifiers, getNumberTokens } = require('./src/utils/helpers');

const tests = [
  {
    name: "Ca 1: Nhà phố cùng số nhà (Đã fix lỗi Số Nhà)",
    t1: "Quyền sử dụng đất có diện tích 114,5m2 và nhà ở có diện tích xây dựng 72,2m2 thuộc thửa đất số 615 tờ bản đồ số 35 tọa lạc tại địa chỉ 55/5F ấp Trung Lân, xã Bà Điểm, huyện Hóc Môn, thành phố Hồ Chí Minh.",
    t2: "Quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất tại số 55/5F ấp Trung Lân, xã Bà Điểm, huyện Hóc Môn (nay là xã Bà Điểm), Thành phố Hồ Chí Minh."
  },
  {
    name: "Ca 2: Xe ô tô (Định danh mạnh Biển số & Số khung - Fix cắt số)",
    t1: "Xe ô tô con 05 chỗ ngồi nhãn hiệu Toyota Camry, biển số 51H-123.45, số khung: V781894, số máy: 893475.",
    t2: "Tài sản đấu giá là 01 chiếc xe ô tô con nhãn hiệu Toyota biển kiểm soát 51H12345, số khung V781894"
  },
  {
    name: "Ca 3: Đất đai (Cùng thửa, tờ bản đồ)",
    t1: "Quyền sử dụng đất thuộc thửa đất số 112, tờ bản đồ số 15 tại xã Xuân Thới Thượng, huyện Hóc Môn",
    t2: "Quyền sử dụng đất ở tại Thửa đất số 112 tờ bản đồ số 15 tọa lạc tại xã Xuân Thới Thượng, huyện Hóc Môn"
  },
  {
    name: "Ca 4: Căn hộ chung cư",
    t1: "Căn hộ số 12A.05, tầng 12A, tháp B, chung cư Masteri Thảo Điền, Quận 2",
    t2: "Quyền sở hữu nhà ở tại căn 12A.05 chung cư Masteri Thảo Điền, thành phố Thủ Đức"
  },
  {
    name: "Ca 5: Lệch thông tin thửa đất (Chống gộp láo - Nên REJECT)",
    t1: "Quyền sử dụng đất thuộc thửa đất số 112, tờ bản đồ số 15 tại xã Xuân Thới Thượng",
    t2: "Quyền sử dụng đất thuộc thửa đất số 113, tờ bản đồ số 15 tại xã Xuân Thới Thượng"
  },
  {
    name: "Group 1: Nhà Lê Văn Hưu (Khác mô tả, chung số nhà, thửa, tờ)",
    t1: "Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh được UBND Quận 1 cấp Giấy chứng nhận quyền sử dụng đất số AG 245065 ngày 30/10/2006. Gồm: a) Quyền sử dụng đất ở: - Thửa đất số 22, tờ bản đồ số 17. - Địa chỉ thửa đất: số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh. - Diện tích: 553,1m2. - Hình thức sử dụng: + Sử dụng riêng: 5,6m2 + Sử dụng chung: 267,0m2. - Mục đích sử dụng đất: Đất ở tại đô thị. - Thời hạn sử dụng đất: Lâu dài. - Nguồn gốc sử dụng đất: Nhà nước công nhận quyền sử dụng đất như Nhà nước giao đất có thu tiền sử dụng đất. b) Tài sản gắn liền với đất: Một phần biệt thự 3 tầng, diện tích xây dựng 133,89m2; kết cấu: tường gạch, sàn BTCT. Căn hộ ở tầng 1 + 2, diện tích sử dụng riêng: 59,93m2, diện tích sử dụng chung: 27,25m2 (phân bổ: 6,67m2). c) Ghi chú: - Lộ giới đường Lê Văn Hưu: 20,0m (10,0m + 10,0m) - Căn hộ thuộc một phần thửa 22, phần diện tích 280,5m2 còn lại thuộc các hộ khác sử dụng. d) Tại thời điểm kê biên tài sản, có diện tích xây dựng phát sinh ngoài diện tích được cấp Giấy chứng nhận quyền sử dụng đất. Phần xây dựng thêm này không được bán đấu giá và chủ sở hữu phần tài sản xây dựng thêm này đồng ý tự nguyện tháo dỡ để trả lại hiện trạng tài sản khi bán đấu giá thành và giao tài sản cho người mua được tài sản đấu giá. Chi phí phát sinh liên quan đến việc tháo dỡ này do chủ sở hữu phần xây dựng thêm chịu. (Thông tin tài sản theo Biên bản về việc kê biên, xử lý tài sản vào lúc 08 giờ 30 phút ngày 16 tháng 01 năm 2024 của Chi cục Thi hành án dân sự Quận 1).",
    t2: "Nhà ở và quyền sử dụng đất ở tại thửa đất số 22, tờ bản đồ số 17; địa chỉ thửa đất: 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1 (nay là phường Sài Gòn), Thành phố Hồ Chí Minh."
  },
  {
    name: "Group 2: 307429 vs 570882",
    t1: "Quyền sử dụng đất có diện tích 114,5m2 và nhà ở có diện tích xây dựng 72,2m2 thuộc thửa đất số 615 tờ bản đồ số 35 tọa lạc tại địa chỉ 55/5F ấp Trung Lân, xã Bà Điểm, huyện Hóc Môn, thành phố Hồ Chí Minh.",
    t2: "Quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất tại số 55/5F ấp Trung Lân, xã Bà Điểm, huyện Hóc Môn (nay là xã Bà Điểm), Thành phố Hồ Chí Minh."
  }
];

for (const test of tests) {
  console.log(`\n\n--- TEST: ${test.name} ---`);
  
  const core1 = extractCoreIdentity(test.t1);
  const core2 = extractCoreIdentity(test.t2);
  const set1 = getBigrams(core1);
  const set2 = getBigrams(core2);
  const ids1 = extractPropertyIdentifiers(test.t1);
  const ids2 = extractPropertyIdentifiers(test.t2);
  const num1 = getNumberTokens(test.t1);
  const num2 = getNumberTokens(test.t2);

  const coreSim = jaccardSimilarity(set1, set2);
  const overlapSim = overlapSimilarity(set1, set2);
  const isConflict = hasConflictingIdentifiers(ids1, ids2);
  const isStrongMatch = hasMatchingStrongIdentifiers(ids1, ids2);
  const bothHaveNumbers = num1.length > 0 && num2.length > 0;
  const commonNumbers = num1.filter(t => num2.includes(t));

  let matched = false;
  let reason = '';

  if (isConflict) {
    matched = false;
    reason = 'Conflict Identifiers';
  } else if (isStrongMatch) {
    matched = true;
    reason = 'Strong Identifier Match';
  } else if (coreSim >= 0.80) {
    matched = true;
    reason = 'Core Similarity >= 80%';
  } else if (bothHaveNumbers && coreSim >= 0.55 && commonNumbers.length > 0) {
    matched = true;
    reason = 'Core Sim >= 55% + Common Numbers';
  } else if (bothHaveNumbers && overlapSim >= 0.85 && commonNumbers.length >= 1) {
    matched = true;
    reason = 'Overlap >= 85% + Common Numbers';
  } else if (ids1.apartment && ids1.apartment === ids2.apartment && (coreSim >= 0.20 || overlapSim >= 0.33)) {
    matched = true;
    reason = 'Same Apartment + Low Overlap';
  } else if (ids1.houseNumber && ids1.houseNumber === ids2.houseNumber && overlapSim >= 0.60) {
    matched = true;
    reason = 'Same House Number + Overlap >= 60%';
  } else {
    reason = 'No rules matched';
  }

  console.log("Core Sim:", coreSim.toFixed(2), "Overlap:", overlapSim.toFixed(2));
  console.log("Conflict:", isConflict, "Strong Match:", isStrongMatch);
  console.log("IDS 1:", ids1);
  console.log("IDS 2:", ids2);
  console.log("=> MATCHED:", matched, " | REASON:", reason);
}
