const { removeDiacritics } = require('../src/utils/helpers');

function extractPropertyIdentifiersDebug(name) {
  if (!name) return {};
  let s = removeDiacritics(name.toLowerCase());
  const ids = {};

  // 1. ĐẤT ĐAI: Thửa đất & Tờ bản đồ
  const plotMatch = s.match(/(?:\bthua\b)\s*(?:dat\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
  if (plotMatch) {
    ids.plotNumber = plotMatch[1].replace(/\s+/g, '');
    s = s.replace(plotMatch[0], ' ');
  }

  // Revised mapMatch logic
  // Pattern A: definite map sheet keywords (tbd, ban do, to ban do) -> no lookahead
  let mapMatch = s.match(/(?:\btbd\b|\bban\s*do\b|\bto\s+ban\s*do\b)\s*(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)\b/i);
  // Pattern B: ambiguous "tờ" -> check lookahead to avoid matching "tổ dân phố / tổ 3"
  if (!mapMatch) {
    mapMatch = s.match(/(?<!\bo\s+)\bto\b(?![\s-]*(?:chuc|hop|dan|nhom|doi|trinh))\s*(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)(?![\s,\.\/\-]*(?:phuong|xa|thi\s*tran|p(?=\s|\d|\.)|q(?=\s|\d|\.)|quan|huyen|tp|thanh\s*pho|tinh|dan\s*pho|dan\s*cu|dan))\b/i);
  }

  if (mapMatch) {
    ids.mapSheet = mapMatch[1].replace(/\s+/g, '');
    s = s.replace(mapMatch[0], ' ');
  }

  // Extract Phường/Xã/Quận/Huyện first
  let sCleanParen = s.replace(/\(\s*(?:nay|truoc\s+day|truoc|doi\s+ten)\s+(?:la|thanh)\s*/gi, ' ');
  sCleanParen = sCleanParen.replace(/[\(\)]/g, ' ');

  const communes = [];
  const communeRegex = /\b(?:phuong\b|xa\b|thi\s*tran\b|p(?=\s|\.|\d))\.?\s*((?:(?!\b(?:phuong|quan|xa|huyen|p|q|tinh|tp|thanh|thanh\s*pho)\b)[a-z0-9\s]){1,30})(?=,|$|[\s]+(?:quan\b|huyen\b|tp\b|thanh\b|hcm\b|phuong\b|quan\b|xa\b|huyen\b|p\b|q\b))/gi;
  let comMatch;
  while ((comMatch = communeRegex.exec(sCleanParen)) !== null) {
    const com = comMatch[1].trim();
    if (!communes.includes(com)) communes.push(com);
  }
  if (communes.length > 0) {
    ids.commune = communes[0];
  }

  // Extract house number with negative lookbehind to avoid matching thửa, tờ, lô, ô, gcn, ...
  let houseMatch = s.match(/(?:so\s*nha|dia\s*chi|tai\s*so|nha\s*o\s*so|nha\s*dat\s*so|nha\s*so|toa\s*lac\s*tai|toa\s*lac)\s*[:\.]?\s*([0-9]+[a-z0-9\/\-]*)\b/i);
  if (!houseMatch) {
    houseMatch = s.match(/(?<!\b(?:thua|to|tbd|lo|o|gcn|seri|qd|quyet\s+dinh|cv|cong\s+van|ban\s+an|ba|so|sk|sm|chuyen\s+khoan)\s+(?:dat\s+)?(?:so\s+)?)\bso\s*[:\.]?\s*([0-9]+[a-z0-9\/\-]*)\b/i);
  }
  if (houseMatch && !/^(19|20)\d{2}$/.test(houseMatch[1])) {
    ids.houseNumber = houseMatch[1].replace(/\s+/g, '').toUpperCase();
  }

  return ids;
}

const text1 = "Quyền sử dụng đất tại thửa đất số 2207, tờ bản đồ số 3, phường An Phú, Quận 2 (nay là Thành phố Thủ Đức), Thành phố Hồ Chí Minh";
const text2 = "Thửa đất số 100, tờ bản đồ 4, xã An Phú";
const text3 = "Tổ 3, phường An Phú"; 
const text4 = "QSD đất thửa số 301 (mới 226) số tờ 19 (mới 10)... QSD đất thửa số 321 (mới 6)";

console.log("text1:", extractPropertyIdentifiersDebug(text1));
console.log("text2:", extractPropertyIdentifiersDebug(text2));
console.log("text3:", extractPropertyIdentifiersDebug(text3));
console.log("text4:", extractPropertyIdentifiersDebug(text4));


