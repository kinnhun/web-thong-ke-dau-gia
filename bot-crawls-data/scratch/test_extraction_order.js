const { extractPropertyIdentifiers, removeDiacritics } = require('../src/utils/helpers');

const text = "Quyền sử dụng đất thửa đất số 67, tờ bản đồ số 51 tọa lạc 186/32 Trần Quang Khải, P.Tân Định, Quận 1, TPHCM.";

console.log("Input:", text);
const ids = extractPropertyIdentifiers(text);
console.log("Final extracted identifiers:", ids);

// Step by step replication
let s = removeDiacritics(text.toLowerCase());

console.log("\n--- Trace ---");
console.log("Initial s:", JSON.stringify(s));

const plotMatch = s.match(/(?:\bthua\b)\s*(?:dat\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)/i);
if (plotMatch) {
  console.log("plotMatch[0]:", JSON.stringify(plotMatch[0]));
  console.log("plotMatch[1]:", JSON.stringify(plotMatch[1]));
  s = s.replace(plotMatch[0], ' ');
  console.log("s after plot replacement:", JSON.stringify(s));
}

const mapMatch = s.match(/(?:\btbd\b|\bban\s*do\b|(?<!\bo\s+)\bto\b(?![\s-]*(?:chuc|hop|dan|nhom|doi|trinh)))\s*(?:ban\s*do\s*)?(?:so\s*)?[:\.]?\s*(\d+[a-z]?(?:[/-]\d+[a-z]?(?:\(\d+\))?)?)(?![\s,\.\/\-]*(?:phuong|xa|thi\s*tran|p(?=\s|\d|\.)|q(?=\s|\d|\.)|quan|huyen|tp|thanh\s*pho|tinh|dan\s*pho|dan\s*cu|dan))\b/i);
if (mapMatch) {
  console.log("mapMatch[0]:", JSON.stringify(mapMatch[0]));
  console.log("mapMatch[1]:", JSON.stringify(mapMatch[1]));
  s = s.replace(mapMatch[0], ' ');
  console.log("s after map replacement:", JSON.stringify(s));
}

let houseMatch = s.match(/(?:so\s*nha|dia\s*chi|tai\s*so|nha\s*o\s*so|nha\s*dat\s*so|nha\s*so|toa\s*lac\s*tai|toa\s*lac)\s*[:\.]?\s*([0-9]+[a-z0-9\/\-]*)\b/i);
if (houseMatch) {
  console.log("houseMatch 1[0]:", JSON.stringify(houseMatch[0]));
  console.log("houseMatch 1[1]:", JSON.stringify(houseMatch[1]));
} else {
  console.log("houseMatch 1 failed.");
  houseMatch = s.match(/\bso\s*[:\.]?\s*([0-9]+[a-z0-9\/\-]*)\b/i);
  if (houseMatch) {
    console.log("houseMatch 2[0]:", JSON.stringify(houseMatch[0]));
    console.log("houseMatch 2[1]:", JSON.stringify(houseMatch[1]));
  } else {
    console.log("houseMatch 2 failed.");
  }
}
