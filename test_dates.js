const getNumberTokens = (str) => {
  let s = str.toLowerCase();
  // Xóa "ngày...", "tháng...", "năm..." đi kèm số
  s = s.replace(/\b(ngày|tháng|năm)\s*\d+([\/\-]\d+)*\b/g, '');
  // Xóa các năm đứng lẻ loi (ví dụ: 2022, 2023, 2024...)
  s = s.replace(/\b(19\d{2}|20\d{2})\b/g, '');
  
  const tokens = s.match(/[\w/\\-]*\d+[\w/\\-]*/g) || [];
  return [...new Set(tokens)];
};

const str1 = "ngày 10/2 đăng bán nhà căn hộ số 2/01";
const str2 = "đăng bán căn nhà số 2/01";
console.log("str1:", getNumberTokens(str1));
console.log("str2:", getNumberTokens(str2));

const str3 = "ngày 10/2 đăng bán nhà số 5";
const str4 = "ngày 10/2 đăng bán nhà số 6 năm 2023";
console.log("str3:", getNumberTokens(str3));
console.log("str4:", getNumberTokens(str4));
