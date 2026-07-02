const { extractPropertyIdentifiers, hasConflictingIdentifiers } = require('./bot-crawls-data/src/utils/helpers');

// Let's test the false positive examples of "ô tô 46 chỗ" -> mapSheet: 46
const s1 = "06 xe mô tô, 01 xe ô tô 46 chỗ";
const ids1 = extractPropertyIdentifiers(s1);
console.log(`IDs for: "${s1}":`, ids1);

const s2 = "Quyền sử dụng đất tại thửa 152 tờ bản đồ 10";
const ids2 = extractPropertyIdentifiers(s2);
console.log(`IDs for: "${s2}":`, ids2);

// Let's test "TO102"
const s3 = "thửa đất số 236, tờ bản đồ số 491-III-D-d, Tổ 10, phường Hợp Giang";
const ids3 = extractPropertyIdentifiers(s3);
console.log(`IDs for: "${s3}":`, ids3);

// Let's test model number matching / conflict
const idsA = extractPropertyIdentifiers("Xe ô tô 7 chỗ nhãn hiệu Toyota Innova, biển số 51A-2773, model AE101");
const idsB = extractPropertyIdentifiers("Xe ô tô 7 chỗ nhãn hiệu Toyota Innova, biển số 80H-0913, model AE101");
console.log("idsA:", idsA);
console.log("idsB:", idsB);
console.log("Conflict between idsA and idsB:", hasConflictingIdentifiers(idsA, idsB));
