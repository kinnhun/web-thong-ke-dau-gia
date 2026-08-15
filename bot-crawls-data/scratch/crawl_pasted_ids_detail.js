const fs = require('fs');
const path = require('path');
const { connectDB, closeDB } = require('../src/db');
const { initBrowser, closeBrowser } = require('../src/browser');
const { fetchAuctionItemDetail } = require('../src/scrapers/detail.scraper');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const { delay } = require('../src/utils/helpers');

async function crawlPastedIDsDetail() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   🤖 CÀO CHI TIẾT NỘI DUNG 308 BÀI VIẾT ĐẤU GIÁ          ║');
  console.log('║   Nguồn: dgts.moj.gov.vn                                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const auditPath = path.join(__dirname, '../../bot-check-tai-san/scratch/audit_pasted_ids_result.json');
  if (!fs.existsSync(auditPath)) {
    console.error('❌ Không tìm thấy file audit_pasted_ids_result.json!');
    process.exit(1);
  }

  const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
  const targetIDs = auditData.missingDetailedContentIDs || [];

  if (targetIDs.length === 0) {
    console.log('🎉 Không có ID nào cần cào chi tiết!');
    return;
  }

  console.log(`📌 Bắt đầu tiến trình cào chi tiết cho ${targetIDs.length} IDs...`);

  await connectDB();
  console.log('🌐 Khởi tạo Puppeteer Browser & Bypass FEC...');
  await initBrowser();

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < targetIDs.length; i++) {
    const sourceId = targetIDs[i];
    const idxStr = `[${i + 1}/${targetIDs.length}]`;

    try {
      // 1. Kiểm tra xem đã có bài chi tiết chưa
      const existing = await AuctionNotice.findOne({ sourceId, detailScraped: true }).lean();
      if (existing) {
        console.log(`ℹ️ ${idxStr} ID #${sourceId} - Đã có dữ liệu chi tiết, bỏ qua.`);
        skippedCount++;
        continue;
      }

      // 2. Fetch chi tiết từ API
      let updates = {};
      let files = [];
      let fetchSuccess = false;

      try {
        const res = await fetchAuctionItemDetail(sourceId);
        updates = res.updates || {};
        files = res.files || [];
        fetchSuccess = true;
      } catch (err) {
        // Nếu API báo không có item (bài viết rỗng/đã xoá trên server), xử lý fallback
        updates = {
          name: `[Bài viết Rỗng / Đã Xoá trên Server BTP] ID #${sourceId}`,
          detailScraped: true,
          isEmptyOrDeleted: true,
        };
      }
      
      const noticeData = {
        sourceId,
        name: updates.name || `Thông báo đấu giá #${sourceId}`,
        shortDescription: updates.shortDescription || '',
        titleName: updates.titleName || '',
        province: updates.province || '',
        address: updates.address || '',
        initialPrice: updates.initialPrice || 0,
        currentPrice: updates.currentPrice || updates.initialPrice || 0,
        deposit: updates.deposit || 0,
        depositPercent: updates.depositPercent || '',
        applicationFee: updates.applicationFee || 0,
        properties: updates.properties || [],
        organizer: updates.organizer || '',
        owner: updates.owner || '',
        publishedAt: updates.publishedAt || null,
        auctionDate: updates.auctionDate || null,
        sourceUrl: updates.sourceUrl || `https://dgts.moj.gov.vn/portal/thong-bao-cong-khai-viec-dau-gia/detail-${sourceId}.html`,
        files: files || [],
        publishRound: updates.publishRound || 1,
        publishRoundLabel: updates.publishRoundLabel || '',
        rootId: updates.rootId || null,
        relatedIds: updates.relatedIds || [],
        detailScraped: true,
        lastCrawledAt: new Date(),
      };

      // 3. Upsert vào AuctionNotice
      await AuctionNotice.updateOne(
        { sourceId },
        { $set: noticeData },
        { upsert: true }
      );

      // 4. Nếu có properties, lưu vào AssetItem
      if (Array.isArray(updates.properties) && updates.properties.length > 0) {
        for (let index = 0; index < updates.properties.length; index++) {
          const prop = updates.properties[index];
          const assetData = {
            noticeId: sourceId,
            sourceType: 'auction',
            sourceId,
            itemIndex: index + 1,
            name: prop.name || noticeData.name,
            startingPrice: prop.startPrice || noticeData.initialPrice || 0,
            quantity: prop.amount || '01',
            province: noticeData.province,
            ownerName: noticeData.owner,
            auctionOrg: noticeData.organizer,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await AssetItem.updateOne(
            { sourceId, itemIndex: index + 1 },
            { $set: assetData },
            { upsert: true }
          );
        }
      }

      successCount++;
      if (fetchSuccess) {
        const priceFormatted = noticeData.initialPrice ? noticeData.initialPrice.toLocaleString('vi-VN') + ' đ' : 'Chưa có giá';
        console.log(`✅ ${idxStr} ID #${sourceId} | Tên: ${noticeData.name.slice(0, 45)}... | Giá: ${priceFormatted}`);
      } else {
        console.log(`⚠️ ${idxStr} ID #${sourceId} | Mã Rỗng/Đã xoá trên server BTP (Đã đánh dấu trong DB)`);
      }

      // Rest 800ms - 1.2s giữa các lượt cào
      await delay(800 + Math.random() * 400);

    } catch (err) {
      errorCount++;
      console.error(`❌ ${idxStr} ID #${sourceId} lỗi cào chi tiết: ${err.message}`);
      await delay(2000);
    }
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log(`🎉 HOÀN THÀNH CÀO CHI TIẾT CHO NGUYÊN DANH SÁCH!`);
  console.log(`   - Thành công: ${successCount} IDs`);
  console.log(`   - Đã có sẵn: ${skippedCount} IDs`);
  console.log(`   - Lỗi: ${errorCount} IDs`);
  console.log(`   - Thời gian thực hiện: ${durationSec} giây`);
  console.log('═'.repeat(60) + '\n');

  await closeBrowser();
  await closeDB();
}

crawlPastedIDsDetail().catch(console.error);
