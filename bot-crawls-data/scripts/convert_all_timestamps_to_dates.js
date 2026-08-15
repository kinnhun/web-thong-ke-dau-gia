const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const { parseDate } = require('../src/utils/helpers');

async function convertAllDates() {
  console.log('🚀 Đang chuẩn hóa lại 100% trường publishedAt từ timestamp sang Date object chuẩn...');
  await connectDB();

  const cursor = AuctionNotice.find({}).lean().cursor();
  let updatedCount = 0;
  let batchOps = [];

  for await (const doc of cursor) {
    const rawPub1 = doc.publishTime1;
    const rawPub2 = doc.publishTime2;
    const rawPub = doc.publishTime;
    const rawPublishedAt = doc.publishedAt;

    let parsedDate = parseDate(rawPub1)
      || parseDate(rawPub2)
      || parseDate(rawPub)
      || parseDate(rawPublishedAt)
      || parseDate(doc.createdDate)
      || parseDate(doc.lastUpdated)
      || parseDate(doc.aucRegTimeStart);

    if (parsedDate && !isNaN(new Date(parsedDate).getTime())) {
      const validDate = new Date(parsedDate);

      // So sánh nếu publishedAt trong DB khác với validDate thì mới update
      if (!doc.publishedAt || new Date(doc.publishedAt).getTime() !== validDate.getTime()) {
        batchOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { publishedAt: validDate } }
          }
        });
      }
    }

    if (batchOps.length >= 2000) {
      updatedCount += batchOps.length;
      await AuctionNotice.bulkWrite(batchOps, { ordered: false });
      batchOps = [];
      console.log(`  💾 Đã cập nhật ${updatedCount} bản ghi...`);
    }
  }

  if (batchOps.length > 0) {
    updatedCount += batchOps.length;
    await AuctionNotice.bulkWrite(batchOps, { ordered: false });
  }

  console.log(`✅ Đã chuẩn hóa ngày xuất bản (publishedAt) thành công cho ${updatedCount} bài đăng!`);

  await closeDB();
  process.exit(0);
}

convertAllDates().catch(console.error);
