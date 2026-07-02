const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { connectDB, closeDB } = require('./src/db');
const { closeBrowser } = require('./src/browser');
const { crawlAuctionNotices } = require('./src/scrapers/auctionNotice.scraper');
const AuctionNotice = require('./src/models/AuctionNotice');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('==================================================');
  console.log('🤖 CLI CRAWLER BOT - THÔNG BÁO ĐẤU GIÁ 🤖');
  console.log('==================================================\n');

  try {
    const inputPages = await askQuestion('Nhập số trang muốn cào (ví dụ: 100): ');
    const maxPages = parseInt(inputPages, 10);

    if (isNaN(maxPages) || maxPages <= 0) {
      console.log('❌ Số trang không hợp lệ! Vui lòng nhập số nguyên lớn hơn 0.');
      rl.close();
      return;
    }

    console.log(`\n🚀 Bắt đầu kết nối CSDL và khởi chạy trình duyệt...`);
    await connectDB();

    const startTime = new Date();
    console.log(`\n⏳ Đang cào ${maxPages} trang từ trang 1 đến trang ${maxPages}...`);
    console.log(`⚠️  Nếu gặp dữ liệu đã có sẵn (trùng ID) trong máy, bot sẽ tự động bỏ qua.`);

    // Chạy crawler chính của hệ thống
    const stats = await crawlAuctionNotices({
      maxPages,
      startPage: 1,
      isAuto: false, // isAuto=false để không dừng sớm khi gặp các bản cũ (skipThreshold)
      listOnly: false
    });

    console.log('\n==================================================');
    console.log('📊 KẾT QUẢ CÀO DỮ LIỆU:');
    console.log(`- Thêm mới: ${stats.inserted} bản ghi`);
    console.log(`- Bỏ qua (trùng ID): ${stats.skipped} bản ghi`);
    console.log(`- Lỗi: ${stats.errors} bản ghi`);
    console.log('==================================================\n');

    // Truy vấn dữ liệu mới cào được dựa trên mốc thời gian chạy script
    console.log('💾 Đang truy xuất dữ liệu mới cào để lưu thành file JSON...');
    const newItems = await AuctionNotice.find({
      createdAt: { $gte: startTime }
    }).lean();

    if (newItems.length > 0) {
      const fileName = `crawled_auctions_${Date.now()}.json`;
      const filePath = path.join(__dirname, fileName);
      fs.writeFileSync(filePath, JSON.stringify(newItems, null, 2), 'utf-8');
      console.log(`✅ Đã xuất ${newItems.length} bản ghi mới cào thành công về máy!`);
      console.log(`📂 File dữ liệu lưu tại: ${filePath}`);
    } else {
      console.log('ℹ️ Không có bản ghi mới nào được cào thêm (tất cả đều bị trùng hoặc lỗi). Không xuất file JSON.');
    }

  } catch (err) {
    console.error('❌ Có lỗi xảy ra trong quá trình cào:', err.message);
  } finally {
    rl.close();
    await closeBrowser();
    await closeDB();
    console.log('🏁 Bot đã đóng kết nối và thoát.');
    process.exit(0);
  }
}

main();
