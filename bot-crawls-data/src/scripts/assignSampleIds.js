require('dotenv').config();
const { connectDB } = require('../db');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const AuctionSample = require('../models/AuctionSample');

async function run() {
  await connectDB();
  console.log('--- BẮT ĐẦU CẬP NHẬT SAMPLE ID CHO DỮ LIỆU CŨ ---');

  const models = [
    { model: AuctionNotice, name: 'AuctionNotice' },
    { model: OrgSelection, name: 'OrgSelection' }
  ];

  for (const { model, name } of models) {
    console.log(`\nĐang xử lý ${name}...`);
    // Find all items without a sampleId that have a name
    const items = await model.find({ sampleId: { $exists: false }, name: { $exists: true, $ne: '' } });
    console.log(`Tìm thấy ${items.length} bản ghi chưa có sampleId.`);

    let updatedCount = 0;
    for (const item of items) {
      if (!item.name) continue;

      const sample = await AuctionSample.findOneAndUpdate(
        { name: item.name },
        { $setOnInsert: { name: item.name } },
        { upsert: true, new: true }
      );

      item.sampleId = sample._id;
      await item.save();
      updatedCount++;

      if (updatedCount % 100 === 0) {
        console.log(`Đã cập nhật ${updatedCount}/${items.length}...`);
      }
    }
    console.log(`Hoàn thành ${name}: cập nhật ${updatedCount} bản ghi.`);
  }

  console.log('\n--- KẾT THÚC ---');
  process.exit(0);
}

run().catch(console.error);
