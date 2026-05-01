const mongoose = require('mongoose');
const { getBigrams, jaccardSimilarity } = require('./bot-crawls-data/src/utils/helpers');

// Khởi tạo model đơn giản
const schema = new mongoose.Schema({
  sourceId: Number,
  name: String,
  relatedIds: [Number]
}, { strict: false });

const AuctionNotice = mongoose.model('AuctionNotice', schema, 'auctionnotices');
const OrgSelection = mongoose.model('OrgSelection', schema, 'orgselections');

const getNumberTokens = (str) => {
  if (!str) return [];
  const tokens = str.toLowerCase().match(/[\w/\\-]*\d+[\w/\\-]*/g) || [];
  return [...new Set(tokens)];
};

async function cleanRelatedIds(Model, label) {
  console.log(`Bắt đầu dọn dẹp ${label}...`);
  const items = await Model.find({ relatedIds: { $exists: true, $not: { $size: 0 } } }).lean();
  let fixedCount = 0;

  for (const item of items) {
    if (!item.name) continue;
    const targetNumbers = getNumberTokens(item.name);
    const validRelatedIds = [];
    let changed = false;

    for (const rid of item.relatedIds) {
      // Find the related item to check its name
      const relatedItem = await Model.findOne({ sourceId: Number(rid) }).lean();
      if (!relatedItem || !relatedItem.name) {
        validRelatedIds.push(rid); // Giữ lại nếu không tìm thấy (có thể từ nguồn khác)
        continue;
      }

      const candidateNumbers = getNumberTokens(relatedItem.name);
      let bothHaveNumbers = targetNumbers.length > 0 && candidateNumbers.length > 0;
      
      let shouldKeep = true;
      if (bothHaveNumbers) {
        const common = targetNumbers.filter(t => candidateNumbers.includes(t));
        if (common.length === 0) {
          shouldKeep = false; // KHÔNG CHUNG SỐ -> LỖI SAI CỦA THUẬT TOÁN CŨ
        }
      }

      if (shouldKeep) {
        validRelatedIds.push(rid);
      } else {
        changed = true;
        console.log(`[CLEAN] Đã gỡ liên kết sai giữa ${item.sourceId} và ${rid}`);
      }
    }

    if (changed) {
      await Model.updateOne({ _id: item._id }, { $set: { relatedIds: validRelatedIds } });
      fixedCount++;
    }
  }
  console.log(`Dọn dẹp ${label} hoàn tất. Sửa ${fixedCount} bản ghi.`);
}

async function run() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  await cleanRelatedIds(AuctionNotice, 'AuctionNotice');
  await cleanRelatedIds(OrgSelection, 'OrgSelection');
  await mongoose.disconnect();
}

run().catch(console.error);
