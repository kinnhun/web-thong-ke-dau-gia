const mongoose = require('mongoose');
const { extractCoreIdentity, getBigrams, jaccardSimilarity, getNumberTokens } = require('./src/utils/helpers');

const schema = new mongoose.Schema({ sourceId: Number, name: String, relatedIds: [Number] }, { strict: false });
const AuctionNotice = mongoose.model('AuctionNotice', schema, 'auctionnotices');

async function cleanRelatedIds() {
  console.log('Bắt đầu dọn dẹp relatedIds bằng thuật toán V2...');
  const items = await AuctionNotice.find({ relatedIds: { $exists: true, $not: { $size: 0 } } }).lean();
  let fixedCount = 0;

  for (const item of items) {
    if (!item.name) continue;
    const targetCore = extractCoreIdentity(item.name);
    const targetCoreBigrams = getBigrams(targetCore);
    const targetNumbers = getNumberTokens(item.name);
    const validRelatedIds = [];
    let changed = false;

    for (const rid of item.relatedIds) {
      const rel = await AuctionNotice.findOne({ sourceId: Number(rid) }).lean();
      if (!rel || !rel.name) { validRelatedIds.push(rid); continue; }

      const candidateNumbers = getNumberTokens(rel.name);
      const bothHaveNumbers = targetNumbers.length > 0 && candidateNumbers.length > 0;

      // Kiểm tra số
      if (bothHaveNumbers) {
        const common = targetNumbers.filter(t => candidateNumbers.includes(t));
        if (common.length === 0) {
          changed = true;
          console.log(`[CLEAN] Gỡ ${item.sourceId} ↔ ${rid} (số khác nhau)`);
          continue;
        }
      }

      // Kiểm tra core identity
      const candidateCore = extractCoreIdentity(rel.name);
      const coreSim = jaccardSimilarity(targetCoreBigrams, getBigrams(candidateCore));

      let shouldKeep = false;
      if (coreSim >= 0.80) shouldKeep = true;
      else if (bothHaveNumbers && coreSim >= 0.60) {
        const common = targetNumbers.filter(t => candidateNumbers.includes(t));
        if (common.length > 0) shouldKeep = true;
      }

      if (shouldKeep) {
        validRelatedIds.push(rid);
      } else {
        changed = true;
        console.log(`[CLEAN] Gỡ ${item.sourceId} ↔ ${rid} (core sim=${(coreSim*100).toFixed(1)}%)`);
      }
    }

    if (changed) {
      await AuctionNotice.updateOne({ _id: item._id }, { $set: { relatedIds: validRelatedIds } });
      fixedCount++;
    }
  }
  console.log(`Hoàn tất. Sửa ${fixedCount} bản ghi.`);
}

async function run() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  await cleanRelatedIds();
  await mongoose.disconnect();
}
run().catch(console.error);
