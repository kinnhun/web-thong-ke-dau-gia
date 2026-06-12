const mongoose = require('mongoose');
const path = require('path');
const config = require('./src/config');
const AuctionNotice = require('./src/models/AuctionNotice');
const CrawlLog = require('./src/models/CrawlLog');
const { initBrowser, closeBrowser } = require('./src/browser');
const { fetchAuctionItemDetail } = require('./src/scrapers/detail.scraper');

// Cấu hình chạy song song & delay tránh block
const CONCURRENCY = 2; 
const DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Đang kết nối cơ sở dữ liệu MongoDB...');
  await mongoose.connect(config.mongo.uri, {
    family: 4,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 120000,
  });
  console.log('✅ Kết nối MongoDB thành công.');

  // Định nghĩa query tìm tài sản thiếu thông tin (Nơi có tài sản, giá hoặc chi tiết)
  const missingDetailQuery = {
    $or: [
      { detailScraped: { $ne: true } },
      { properties: { $exists: false } },
      { properties: { $size: 0 } },
      {
        properties: {
          $elemMatch: {
            $or: [
              { place: { $exists: false } },
              { place: null },
              { place: '' },
              { place: '-' },
              { place: '—' },
              { place: /^\s*[\-\—\s]*\s*$/ }
            ]
          }
        }
      }
    ]
  };

  const totalScanned = await AuctionNotice.countDocuments({});
  const matchedCount = await AuctionNotice.countDocuments(missingDetailQuery);

  console.log(`📊 Tổng số tài sản trong hệ thống: ${totalScanned}`);
  console.log(`🔍 Số tài sản thiếu thông tin (nơi có tài sản/chi tiết): ${matchedCount}`);

  if (matchedCount === 0) {
    console.log('✅ Hệ thống không có tài sản nào thiếu thông tin. Hoàn tất!');
    await mongoose.disconnect();
    return;
  }

  // Khởi tạo Nhật ký Crawl trong DB để đồng bộ hiển thị lên Dashboard UI
  const log = await CrawlLog.create({
    type: 'recrawl_missing_properties',
    startedAt: new Date(),
    status: 'running',
    totalPages: matchedCount,
    pagesProcessed: 0,
    itemsInserted: totalScanned,
    itemsUpdated: 0,
    itemsSkipped: 0,
    errorMessages: [],
    recentNotices: [],
  });

  console.log(`📝 Đã khởi tạo nhật ký cào lại (Log ID: ${log._id})`);
  console.log('🌐 Đang khởi tạo trình duyệt (Headless mode)...');
  await initBrowser();
  console.log('✅ Trình duyệt sẵn sàng!');

  const cursor = AuctionNotice.find(missingDetailQuery)
    .select({ _id: 1, sourceId: 1, name: 1, province: 1, address: 1, initialPrice: 1, deposit: 1, depositPercent: 1, propertyAmount: 1, quality: 1 })
    .sort({ publishedAt: -1 })
    .cursor();

  let processed = 0;
  let successCount = 0;
  let errorCount = 0;
  let batch = [];

  const updateLog = async () => {
    await CrawlLog.updateOne(
      { _id: log._id },
      {
        $set: {
          pagesProcessed: processed,
          itemsUpdated: successCount,
          itemsSkipped: errorCount,
          updatedAt: new Date(),
        }
      }
    );
  };

  async function processItem(item) {
    try {
      console.log(`[Cào #${item.sourceId}] Đang tải chi tiết cho: "${item.name ? item.name.substring(0, 50) : 'Tài sản không tên'}..."`);
      
      const { updates, files } = await fetchAuctionItemDetail(item.sourceId);
      
      const parentAddress = updates.address || item.address || '';
      const parentProvince = updates.province || item.province || '';
      const parentName = updates.name || item.name || '';

      // Áp dụng Fallback cho Nơi có tài sản (place) và thông tin giá trị
      if (updates.properties && updates.properties.length > 0) {
        updates.properties = updates.properties.map(p => {
          let place = p.place ? p.place.trim() : '';
          
          // Nếu nơi có tài sản bị trống hoặc chứa ký tự gạch ngang
          if (!place || /^[\s\-\—]*$/.test(place)) {
            place = parentAddress || parentProvince || 'Chưa cập nhật địa điểm';
          }

          let startPrice = p.startPrice || 0;
          if (!startPrice && (updates.initialPrice || item.initialPrice)) {
            startPrice = updates.initialPrice || item.initialPrice || 0;
          }

          let deposit = p.deposit || 0;
          if (!deposit && (updates.deposit || item.deposit)) {
            deposit = updates.deposit || item.deposit || 0;
          }

          return {
            ...p,
            place,
            startPrice,
            deposit
          };
        });
      } else {
        // Fallback tự sinh dòng tài sản nếu properties bị trống từ API
        updates.properties = [{
          name: parentName,
          amount: item.propertyAmount || '01',
          startPrice: updates.initialPrice || item.initialPrice || 0,
          deposit: updates.deposit || item.deposit || 0,
          depositPercent: updates.depositPercent || item.depositPercent || '',
          place: parentAddress || parentProvince || 'Chưa cập nhật địa điểm',
          quality: updates.quality || item.quality || '',
        }];
      }

      // Ghi đè trạng thái đã cào chi tiết thành công
      updates.detailScraped = true;
      updates.lastCrawledAt = new Date();
      if (files && files.length > 0) {
        updates.files = files;
      }

      await AuctionNotice.updateOne({ _id: item._id }, { $set: updates });
      successCount++;
      console.log(`✅ [Thành công #${item.sourceId}] Đã bổ sung thông tin nơi có tài sản.`);
    } catch (err) {
      errorCount++;
      const errMsg = err.message || String(err);
      console.error(`❌ [Thất bại #${item.sourceId}] Lỗi: ${errMsg}`);
      
      // Ghi nhận lỗi vào log
      await CrawlLog.updateOne(
        { _id: log._id },
        { $push: { errorMessages: `[SourceID: ${item.sourceId}] ${errMsg.substring(0, 150)}` } }
      );
    } finally {
      processed++;
      if (processed % 5 === 0) {
        await updateLog();
      }
    }
  }

  for (let item = await cursor.next(); item != null; item = await cursor.next()) {
    batch.push(processItem(item));

    if (batch.length >= CONCURRENCY) {
      await Promise.all(batch);
      batch = [];
      await sleep(DELAY_MS); // Nghỉ tránh bị chặn
    }
  }

  if (batch.length > 0) {
    await Promise.all(batch);
  }

  // Kết thúc log
  await CrawlLog.updateOne(
    { _id: log._id },
    {
      $set: {
        status: 'completed',
        finishedAt: new Date(),
        pagesProcessed: processed,
        itemsUpdated: successCount,
        itemsSkipped: errorCount,
      }
    }
  );

  console.log('\n==============================================');
  console.log('🎉 TIẾN TRÌNH CÀO LẠI CHI TIẾT HOÀN TẤT!');
  console.log(`- Tổng số đã xử lý: ${processed}`);
  console.log(`- Thành công: ${successCount}`);
  console.log(`- Thất bại/Lỗi: ${errorCount}`);
  console.log('==============================================');

  await closeBrowser();
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('💥 Lỗi nghiêm trọng dừng chương trình:', e);
  await closeBrowser();
  try { await mongoose.disconnect(); } catch(err){}
  process.exit(1);
});
