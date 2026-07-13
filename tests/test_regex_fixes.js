const { removeDiacritics } = require('./bot-crawls-data/src/utils/helpers');

// Helper function to extract identifiers with our fixes
function extractPropertyIdentifiersFixed(name) {
  if (!name) return {};
  let s = removeDiacritics(name.toLowerCase());
  s = s.replace(/toa lac tai/g, ' ');
  s = s.replace(/toa lac/g, ' ');
  
  const ids = {};

  // 1. ĐẤT ĐAI: Thửa đất & Tờ bản đồ
  const plotMatch = s.match(/(?:\bthua\b|\bt\b)\s*(?:dat\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
  if (plotMatch) ids.plotNumber = plotMatch[1].replace(/\s+/g, '');

  const mapMatch = s.match(/(?:\bto\b|\btbd\b|\bban\s*do\b)\s*(?:ban\s*do\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
  if (mapMatch) ids.mapSheet = mapMatch[1].replace(/\s+/g, '');

  // 2. CHUNG CƯ / DỰ ÁN: Căn hộ (phải có word boundary và filter giá trị rác)
  const aptMatch = s.match(/\b(?:can\s*ho|phong|ma\s*can|can|unit)\b\s*(?:so)?\s*[:\.]?\s*([a-z0-9]+(?:[.-][a-z0-9]+)?)/i);
  if (aptMatch) {
    const val = aptMatch[1].toUpperCase();
    // Loại bỏ giá trị rác: dài >= 3 ký tự và không chứa số (ví dụ: PHU, TAN, TOAN, NAM, BAC...)
    const hasDigit = /\d/.test(val);
    if (val.length < 3 || hasDigit) {
      ids.apartment = val;
    }
  }

  // Tòa nhà / Block (phải có word boundary và filter giá trị rác)
  const blockMatch = s.match(/\b(?:toa\s*nha|toa|block|thap|tower|building)\b\s*[:\.]?\s*([a-z0-9]+)/i);
  if (blockMatch && blockMatch[1] && !/^(phuong|xa|quan|huyen|tinh|lac|do)$/i.test(blockMatch[1])) {
    const val = blockMatch[1].toUpperCase();
    const hasDigit = /\d/.test(val);
    if (val.length < 3 || hasDigit) {
      ids.block = val;
    }
  }

  // Rest of identifiers...
  // (Omitted for brevity in this test script)
  
  return ids;
}

// Test cases
const testCases = [
  // False positives from user's examples
  "Tài sản là quyền sử dụng đất theo quy định của pháp luật về đất đai -11 lô Phong Phú",
  "Khu 82 ha; Khu Doi Bắc (giáp đất HTX)... Khu vực Chốt Biên phòng Phú Tân quản lý...",
  "Toàn bộ 18 khoản nợ được đảm bảo bằng quyền tài sản tại Dự án KCN Phong Phú.",
  "Bán đấu giá không tách rời toàn bộ 18 khoản nợ được đảm bảo bằng quyền tài sản tại Dự án KCN Phong Phú (tọa lạc tại xã Phong Phú, huyện Bình Chánh, Tp. HCM) theo nguyên trạng khoản nợ.",
  "Cây cao su thanh lý trên diện tích 16,37 ha thuộc Đội Cao su Phong Phú (lô 1)",
  
  // Real positive cases
  "Căn hộ số 1205 tòa nhà A",
  "Phòng A1 block B",
  "Căn hộ B tòa Landmark", // Building name Landmark is filtered by length >= 3 and no digit
  "Căn hộ B tòa L1", // Keep block L1 (has digit)
  "phòng 5",
  "Block A"
];

for (const text of testCases) {
  console.log(`\nText: "${text}"`);
  console.log(`Extracted:`, extractPropertyIdentifiersFixed(text));
}
