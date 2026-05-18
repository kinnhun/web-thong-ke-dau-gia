const { extractPropertyIdentifiers, getBigrams, extractCoreIdentity, hasMatchingStrongIdentifiers, hasConflictingIdentifiers, jaccardSimilarity, getNumberTokens } = require('../bot-crawls-data/src/utils/helpers.js');

const t1 = `Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh được UBND Quận 1 cấp Giấy chứng nhận quyền sử dụng đất số AG 245065 ngày 30/10/2006. Gồm: a) Quyền sử dụng đất ở: - Thửa đất số 22, tờ bản đồ số 17. - Địa chỉ thửa đất: số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh. - Diện tích: 553,1m2. - Hình thức sử dụng: + Sử dụng riêng: 5,6m2 + Sử dụng chung: 267,0m2. - Mục đích sử dụng đất: Đất ở tại đô thị. - Thời hạn sử dụng đất: Lâu dài. - Nguồn gốc sử dụng đất: Nhà nước công nhận quyền sử dụng đất như Nhà nước giao đất có thu tiền sử dụng đất. b) Tài sản gắn liền với đất: Một phần biệt thự 3 tầng, diện tích xây dựng 133,89m2; kết cấu: tường gạch, sàn BTCT. Căn hộ ở tầng 1 + 2, diện tích sử dụng riêng: 59,93m2, diện tích sử dụng chung: 27,25m2 (phân bổ: 6,67m2). c) Ghi chú: - Lộ giới đường Lê Văn Hưu: 20,0m (10,0m + 10,0m) - Căn hộ thuộc một phần thửa 22, phần diện tích 280,5m2 còn lại thuộc các hộ khác sử dụng. d) Tại thời điểm kê biên tài sản, có diện tích xây dựng phát sinh ngoài diện tích được cấp Giấy chứng nhận quyền sử dụng đất. Phần xây dựng thêm này không được bán đấu giá và chủ sở hữu phần tài sản xây dựng thêm này đồng ý tự nguyện tháo dỡ để trả lại hiện trạng tài sản khi bán đấu giá thành và giao tài sản cho người mua được tài sản đấu giá. Chi phí phát sinh liên quan đến việc tháo dỡ này do chủ sở hữu phần xây dựng thêm chịu. (Thông tin tài sản theo Biên bản về việc kê biên, xử lý tài sản vào lúc 08 giờ 30 phút ngày 16 tháng 01 năm 2024 của Chi cục Thi hành án dân sự Quận 1).`;
const t2 = t1;
const t3 = `Nhà ở và quyền sử dụng đất ở tại thửa đất số 22, tờ bản đồ số 17; địa chỉ thửa đất: 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1 (nay là phường Sài Gòn), Thành phố Hồ Chí Minh.`;

const data = [
  { index: 0, sourceIds: [310238], name: t1 },
  { index: 1, sourceIds: [382830], name: t2 },
  { index: 2, sourceIds: [564179], name: t3 },
].map(item => ({
  index: item.index,
  sourceIds: item.sourceIds,
  coreBigrams: getBigrams(extractCoreIdentity(item.name)),
  numbers: getNumberTokens(item.name),
  identifiers: extractPropertyIdentifiers(item.name),
}));

data.sort((a, b) => a.coreBigrams.size - b.coreBigrams.size);
const parent = Array.from({ length: data.length }, (_, i) => i);
const find = (i) => {
  if (parent[i] === i) return i;
  return parent[i] = find(parent[i]);
};
const union = (i, j) => {
  const rootI = find(i);
  const rootJ = find(j);
  if (rootI !== rootJ) parent[rootI] = rootJ;
};

// PRE-PASS
const strongKeys = ['licensePlate', 'chassisNumber', 'engineNumber', 'certificateNumber', 'certificateEntryNumber', 'shipNumber', 'streetAddress', 'taxCode', 'contractNumber', 'ownerName', 'stockAmount', 'serialNumber', 'debtorName'];
const strongMap = new Map();
for (let i = 0; i < data.length; i++) {
  const ids = data[i].identifiers;
  for (const key of strongKeys) {
    if (ids[key]) {
      const hash = key + ':' + ids[key];
      if (!strongMap.has(hash)) strongMap.set(hash, []);
      strongMap.get(hash).push(i);
    }
  }
  if (ids.plotNumber && ids.mapSheet) {
    const hash = 'land:' + ids.plotNumber + ':' + ids.mapSheet;
    if (!strongMap.has(hash)) strongMap.set(hash, []);
    strongMap.get(hash).push(i);
  }
}

for (const indices of strongMap.values()) {
  if (indices.length > 1) {
    for (let k = 0; k < indices.length; k++) {
      for (let m = k + 1; m < indices.length; m++) {
        if (!hasConflictingIdentifiers(data[indices[k]].identifiers, data[indices[m]].identifiers)) {
          union(indices[k], indices[m]);
        }
      }
    }
  }
}

const provGroups = {};
for (let i = 0; i < data.length; i++) {
  const root = find(i);
  if (!provGroups[root]) provGroups[root] = [];
  provGroups[root].push(...data[i].sourceIds);
}

console.log('provGroups:', provGroups);
