const { connectDB, closeDB } = require('./db');
const { initBrowser, fetchNoticePage, closeBrowser } = require('./browser');
const RawAuctionId = require('./models/RawAuctionId');
const CrawlState = require('./models/CrawlState');
const config = require('./config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeNow() {
  return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function extractProvince(item) {
  return item.provinceName || item.province_name || item.province || item.cityName || item.city_name || '';
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.split(' ')[0].split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(y, m - 1, d);
  }
  return null;
}

async function runCrawl(options = {}) {
  const retryOnly = options.retryOnly || process.argv.includes('--retry-failed');
  const missingOnly = options.missingOnly || process.argv.includes('--missing-only');
  const pageSize = config.crawl.pageSize;
  const concurrency = config.crawl.concurrency;

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   🤖 BOT CHECK TÀI SẢN - CÀO TOÀN BỘ 589.476 IDs        ║');
  console.log('║   Nguồn: dgts.moj.gov.vn                               ║');
  console.log(`║   Chế độ: ${missingOnly ? 'CÀO MỤC TIÊU CÁC TRANG THIẾU (--missing-only)' : retryOnly ? 'CÀO LẠI TRANG LỖI (--retry-failed)' : 'CÀO MỚI / RESUME TIẾP TỤC'} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  await connectDB();

  // 1. Kiểm tra trang 1 để lấy tổng số bản ghi và số trang
  console.log('🔍 Đang kiểm tra tổng số bản ghi từ máy chủ Bộ Tư Pháp...');
  await initBrowser();
  const page1Res = await fetchNoticePage(1, pageSize);

  if (!page1Res || !page1Res.items) {
    throw new Error('Không thể tải trang 1 từ máy chủ!');
  }

  const serverTotalItem = page1Res.totalItem || 589476;
  const totalPages = page1Res.pageCount || Math.ceil(serverTotalItem / pageSize);

  console.log(`📊 XÁC NHẬN: Máy chủ báo tổng cộng ${serverTotalItem.toLocaleString('vi-VN')} bản ghi (${totalPages.toLocaleString('vi-VN')} trang)`);

  // 2. Nạp hoặc tạo CrawlState
  let state = await CrawlState.findOne({ jobId: 'full_id_crawl' });
  if (!state) {
    state = new CrawlState({
      jobId: 'full_id_crawl',
      totalRecords: serverTotalItem,
      totalPages: totalPages,
      completedCount: 0,
      pagesCompleted: [],
      pagesFailed: [],
      status: 'running',
      startedAt: new Date(),
    });
  } else {
    state.totalRecords = serverTotalItem;
    state.totalPages = totalPages;
    state.status = 'running';
  }
  await state.save();

  const completedSet = new Set(state.pagesCompleted || []);
  let failedPagesList = (state.pagesFailed || []).map(p => p.pageNumber);

  // Xác định danh sách các trang cần cào
  let pagesToCrawl = [];
  if (missingOnly) {
    if (Array.isArray(options.targetPages) && options.targetPages.length > 0) {
      pagesToCrawl = options.targetPages;
    } else {
      const fs = require('fs');
      const path = require('path');
      const exportPath = path.join(__dirname, '../missing_ids_export.json');
      if (fs.existsSync(exportPath)) {
        try {
          const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
          pagesToCrawl = exportData.targetPages || [];
        } catch (e) {}
      }
    }
    if (pagesToCrawl.length === 0) {
      for (let p = 1; p <= totalPages; p++) {
        if (!completedSet.has(p)) pagesToCrawl.push(p);
      }
    }
    console.log(`📌 Chế độ Cào Mục Tiêu: Tập trung cào ${pagesToCrawl.length} trang chứa ID bị thiếu.`);
  } else if (retryOnly) {
    pagesToCrawl = [...new Set(failedPagesList)].sort((a, b) => a - b);
    console.log(`📌 Chế độ Cào lại: Tìm thấy ${pagesToCrawl.length} trang bị lỗi cần cào lại.`);
  } else {
    for (let p = 1; p <= totalPages; p++) {
      if (!completedSet.has(p)) {
        pagesToCrawl.push(p);
      }
    }
    console.log(`📌 Tiến độ: Đã xong ${completedSet.size}/${totalPages} trang. Còn lại ${pagesToCrawl.length} trang cần cào.`);
  }

  if (pagesToCrawl.length === 0) {
    console.log('🎉 TOÀN BỘ CÁC TRANG ĐÃ ĐƯỢC CÀO HOÀN TẤT VÀ KHÔNG CÒN TRANG LỖI!');
    state.status = 'completed';
    state.finishedAt = new Date();
    await state.save();
    await closeBrowser();
    return;
  }

  let totalInserted = await RawAuctionId.countDocuments();
  let startTime = Date.now();

  // 3. Tiến hành cào theo từng đợt (batch concurrency)
  for (let i = 0; i < pagesToCrawl.length; i += concurrency) {
    const chunk = pagesToCrawl.slice(i, i + concurrency);

    const chunkResults = await Promise.allSettled(chunk.map(async (pageNumber) => {
      const data = await fetchNoticePage(pageNumber, pageSize);
      if (!data || !Array.isArray(data.items)) {
        throw new Error(`Dữ liệu trang ${pageNumber} rỗng hoặc không đúng định dạng`);
      }
      return { pageNumber, items: data.items, rowCount: data.rowCount };
    }));

    for (let j = 0; j < chunkResults.length; j++) {
      const result = chunkResults[j];
      const pageNumber = chunk[j];

      if (result.status === 'fulfilled') {
        const { items } = result.value;
        state.totalApiCalls = (state.totalApiCalls || 0) + 1;
        state.successfulApiCalls = (state.successfulApiCalls || 0) + 1;

        // Chỉ lưu duy nhất ID và pageNumber vào MongoDB
        const bulkOps = items.map((item) => {
          const sourceId = item.id;
          if (!sourceId) return null;
          return {
            updateOne: {
              filter: { sourceId },
              update: {
                $set: {
                  sourceId,
                  pageNumber,
                  crawledAt: new Date(),
                },
              },
              upsert: true,
            },
          };
        }).filter(Boolean);

        if (bulkOps.length > 0) {
          await RawAuctionId.bulkWrite(bulkOps, { ordered: false });
        }

        // Cập nhật trạng thái thành công
        completedSet.add(pageNumber);
        failedPagesList = failedPagesList.filter(p => p !== pageNumber);
        state.pagesCompleted = [...completedSet];
        state.pagesFailed = state.pagesFailed.filter(f => f.pageNumber !== pageNumber);
        state.lastProcessedPage = pageNumber;

      } else {
        state.totalApiCalls = (state.totalApiCalls || 0) + 1;
        state.failedApiCalls = (state.failedApiCalls || 0) + 1;

        const errMessage = result.reason?.message || 'Lỗi không xác định';
        console.error(`❌ Trang P${pageNumber} cào thất bại: ${errMessage}`);

        // Ghi lại danh sách trang lỗi
        const existingFailedIdx = state.pagesFailed.findIndex(f => f.pageNumber === pageNumber);
        if (existingFailedIdx >= 0) {
          state.pagesFailed[existingFailedIdx].error = errMessage;
          state.pagesFailed[existingFailedIdx].failedAt = new Date();
        } else {
          state.pagesFailed.push({ pageNumber, error: errMessage, failedAt: new Date() });
        }
      }
    }

    state.completedCount = state.pagesCompleted.length;
    await state.save();

    // Log tiến độ định kỳ
    const processedPages = state.pagesCompleted.length;
    const progressPct = ((processedPages / totalPages) * 100).toFixed(2);
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    totalInserted = await RawAuctionId.countDocuments();

    console.log(`[${timeNow()}] 📄 Đã xong: ${processedPages}/${totalPages} trang (${progressPct}%) | DB: ${totalInserted.toLocaleString('vi-VN')} IDs | Lỗi: ${state.pagesFailed.length} trang | Thời gian: ${elapsedSec}s`);

    await sleep(config.crawl.delayMs);
  }

  // 4. Kết thúc đợt cào
  totalInserted = await RawAuctionId.countDocuments();
  if (state.pagesCompleted.length >= totalPages) {
    state.status = 'completed';
    state.finishedAt = new Date();
  } else {
    state.status = 'idle';
  }
  await state.save();

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ KẾT THÚC CÀO!`);
  console.log(`   - Tổng ID đã lưu MongoDB: ${totalInserted.toLocaleString('vi-VN')}`);
  console.log(`   - Số trang thành công: ${state.pagesCompleted.length} / ${totalPages}`);
  console.log(`   - Số trang lỗi/thiếu: ${state.pagesFailed.length}`);
  console.log('═'.repeat(60) + '\n');

  // Gọi reporter xuất file HTML
  const { generateHTMLReport } = require('./reporter');
  await generateHTMLReport();

  await closeBrowser();
  await closeDB();
}

if (require.main === module) {
  runCrawl().catch(async (err) => {
    console.error('❌ Crawl error fatal:', err);
    await closeBrowser();
    await closeDB();
    process.exit(1);
  });
}

module.exports = { runCrawl };
