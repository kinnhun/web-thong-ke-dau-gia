const mongoose = require('mongoose');
const Duplicate = require('./src/models/Duplicate');
const AuctionNotice = require('./src/models/AuctionNotice');
const config = require('./src/config');

async function check() {
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB:', config.mongo.uri);

  // Lấy tất cả Duplicate có nhiều hơn 1 id
  const duplicates = await Duplicate.find().lean();
  let hasDiffPrice = 0;

  for (const dup of duplicates) {
    if (!dup.sourceIds || dup.sourceIds.length < 2) continue;

    // Load các bài viết thuộc nhóm duplicate này
    const items = await AuctionNotice.find({ sourceId: { $in: dup.sourceIds } })
      .select('sourceId name initialPrice publishRound sourceUrl')
      .sort({ publishRound: 1 }) // Xếp lần 1, lần 2, ...
      .lean();

    if (items.length < 2) continue;

    const prices = items.map(i => i.initialPrice).filter(Boolean);
    const uniquePrices = [...new Set(prices)];
    const flag = uniquePrices.length > 1 ? '⚡ GIẢM GIÁ' : '= cùng giá';
    if (uniquePrices.length > 1) hasDiffPrice++;
    
    console.log(`\n[${dup.sourceIds.length} lần đăng] ${flag}`);
    console.log(`  Name: ${dup.name.substring(0, 100)}`);
    items.forEach((it) => {
      console.log(`    Lần ${it.publishRound} | sourceId=${it.sourceId} | price=${it.initialPrice?.toLocaleString() || 0}`);
      console.log(`    Link: ${it.sourceUrl || 'N/A'}`);
    });
  }

  console.log(`\n=== TÓM TẮT ===`);
  console.log(`Tổng nhóm bài đăng lặp (>= 2 lần): ${duplicates.length}`);
  console.log(`Nhóm có giảm giá qua các lần đăng: ${hasDiffPrice}`);
  console.log(`Nhóm giữ nguyên giá: ${duplicates.length - hasDiffPrice}`);

  // Kiểm tra 1 record đã có publishRound
  const rec = await AuctionNotice.findOne({ relatedIds: { $not: { $size: 0 } } }).lean();
  if (rec) {
    console.log('\n=== VERIFY FULL RECORD ===');
    console.log('Fields present:');
    const fields = ['sourceId', 'name', 'type', 'province', 'initialPrice', 'publishRound', 'publishRoundLabel', 'rootId', 'relatedIds', 'detailScraped'];
    fields.forEach(f => {
      const val = rec[f];
      const display = Array.isArray(val) ? `[${val.length} items]` : String(val || '').substring(0, 60);
      console.log(`  ${f}: ${display}`);
    });
  }

  await mongoose.disconnect();
}

check().catch(err => { console.error(err); process.exit(1); });
