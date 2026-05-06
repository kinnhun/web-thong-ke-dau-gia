const helpers = require('./bot-crawls-data/src/utils/helpers');
const { extractCoreIdentity, getBigrams, getNumberTokens, extractPropertyIdentifiers, hasConflictingIdentifiers, hasMatchingStrongIdentifiers, jaccardSimilarity } = helpers;

const text1 = `Quyền sử dụng đất và tài sản gắn liền với đất toạ lạc tại địa chỉ số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh được UBND Quận 1 cấp Giấy chứng nhận quyền sử dụng đất số AG 245065 ngày 30/10/2006. Gồm: a) Quyền sử dụng đất ở: - Thửa đất số 22, tờ bản đồ số 17. - Địa chỉ thửa đất: số 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh. - Diện tích: 553,1m2. - Hình thức sử dụng: + Sử dụng riêng: 5,6m2 + Sử dụng chung: 267,0m2. - Mục đích sử dụng đất: Đất ở tại đô thị. - Thời hạn sử dụng đất: Lâu dài. - Nguồn gốc sử dụng đất: Nhà nước công nhận quyền sử dụng đất như Nhà nước giao đất có thu tiền sử dụng đất. b) Tài sản gắn liền với đất: Một phần biệt thự 3 tầng, diện tích xây dựng 133,89m2; kết cấu: tường gạch, sàn BTCT. Căn hộ ở tầng 1 + 2, diện tích sử dụng riêng: 59,93m2, diện tích sử dụng chung: 27,25m2 (phân bổ: 6,67m2). c) Ghi chú: - Lộ giới đường Lê Văn Hưu: 20,0m (10,0m + 10,0m) - Căn hộ thuộc một phần thửa 22, phần diện tích 280,5m2 còn lại thuộc các hộ khác sử dụng. d) Tại thời điểm kê biên tài sản, có diện tích xây dựng phát sinh ngoài diện tích được cấp Giấy chứng nhận quyền sử dụng đất. Phần xây dựng thêm này không được bán đấu giá và chủ sở hữu phần tài sản xây dựng thêm này đồng ý tự nguyện tháo dỡ để trả lại hiện trạng tài sản khi bán đấu giá thành và giao tài sản cho người mua được tài sản đấu giá. Chi phí phát sinh liên quan đến việc tháo dỡ này do chủ sở hữu phần xây dựng thêm chịu. (Thông tin tài sản theo Biên bản về việc kê biên, xử lý tài sản vào lúc 08 giờ 30 phút ngày 16 tháng 01 năm 2024 của Chi cục Thi hành án dân sự Quận 1).`;

const text2 = `Nhà ở và quyền sử dụng đất ở tại thửa đất số 22, tờ bản đồ số 17; địa chỉ thửa đất: 12-20 Lê Văn Hưu, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh.`;

const item1 = { sourceId: 382830, name: text1 };
const item2 = { sourceId: 414997, name: text2 };

const items = [item1, item2];

// Mocking the data structure used in getFuzzyNameGroups
const data = items.map((item, i) => ({
  index: i,
  coreBigrams: getBigrams(extractCoreIdentity(item.name)),
  numbers: getNumberTokens(item.name),
  identifiers: extractPropertyIdentifiers(item.name),
  sourceIds: [item.sourceId]
}));

console.log('Size 1 (Long):', data[0].coreBigrams.size);
console.log('Size 2 (Short):', data[1].coreBigrams.size);
console.log('Identifiers 1:', JSON.stringify(data[0].identifiers, null, 2));
console.log('Identifiers 2:', JSON.stringify(data[1].identifiers, null, 2));

// Simulation of the matching loop
let matched = false;
for (let i = 0; i < data.length; i++) {
  const sizeA = data[i].coreBigrams.size;
  const maxSizeB = sizeA / 0.60;

  for (let j = i + 1; j < data.length; j++) {
    const sizeB = data[j].coreBigrams.size;
    
    // THE CRITICAL FIX: We don't BREAK anymore if sizeB > maxSizeB, we CONTINUE
    // (though in this small test it doesn't matter unless we sort them)
    if (sizeB > maxSizeB) {
        console.log(`Note: sizeB (${sizeB}) > maxSizeB (${maxSizeB.toFixed(2)}) for pair ${i}-${j}`);
        // continue; // My fix
    }

    if (hasConflictingIdentifiers(data[i].identifiers, data[j].identifiers)) {
      console.log('Conflict found');
      continue;
    }

    if (hasMatchingStrongIdentifiers(data[i].identifiers, data[j].identifiers)) {
      console.log(`✅ SUCCESS: Strong Match found for pair ${i}-${j}`);
      matched = true;
      continue;
    }

    const coreSim = jaccardSimilarity(data[i].coreBigrams, data[j].coreBigrams);
    console.log(`Jaccard Similarity: ${coreSim.toFixed(4)}`);
    if (coreSim >= 0.80) {
      console.log('✅ SUCCESS: Jaccard Match');
      matched = true;
    }
  }
}

if (matched) {
    console.log('\nRESULT: Both items will be GROUPED together.');
} else {
    console.log('\nRESULT: Items will NOT be grouped.');
}
