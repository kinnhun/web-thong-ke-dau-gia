const { connectDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  try {
    await connectDB();
    // Reset cho ID cụ thể
    const res = await AuctionNotice.updateOne(
      { sourceId: 560955 },
      { $set: { detailScraped: false } }
    );
    console.log('Reset done:', res);
    
    // Reset thêm vài cái gần đây để bot cào lại bằng logic mới (tùy chọn)
    const res2 = await AuctionNotice.updateMany(
      { detailScraped: true },
      { $set: { detailScraped: false } },
      { limit: 20, sort: { publishedAt: -1 } }
    );
    console.log('Reset 20 recent items:', res2);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
