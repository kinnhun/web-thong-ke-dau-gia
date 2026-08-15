const fs = require('fs');
const path = require('path');
const { connectDB, closeDB } = require('./db');
const RawAuctionId = require('./models/RawAuctionId');
const CrawlState = require('./models/CrawlState');
const { generateCompareHTMLReport } = require('./compare-reporter');
const { logSystem } = require('./logger');


function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    sync: false,
    useAuctions: false,
    rangeMax: null,
    crawlMissing: false,
  };

  args.forEach(arg => {
    if (arg.startsWith('--file=')) {
      options.file = arg.split('=')[1].trim();
    } else if (arg === '--sync') {
      options.sync = true;
    } else if (arg === '--crawl-missing') {
      options.crawlMissing = true;
    } else if (arg === '--use-auctions') {
      options.useAuctions = true;
    } else if (arg.startsWith('--range=')) {
      options.rangeMax = parseInt(arg.split('=')[1].trim(), 10);
    }
  });

  return options;
}

function loadExternalIDs(filePath, rangeMax) {
  if (rangeMax && rangeMax > 0) {
    console.log(`🔢 Tạo tập hợp ID giả định từ 1 đến ${rangeMax.toLocaleString('vi-VN')} để kiểm tra gap...`);
    const ids = new Array(rangeMax);
    for (let i = 0; i < rangeMax; i++) {
      ids[i] = i + 1;
    }
    return { ids, rawTotal: ids.length, duplicateCount: 0, sourceName: `Sequential Range [1..${rangeMax.toLocaleString('vi-VN')}]` };
  }

  let targetFile = filePath;
  if (!targetFile) {
    const potentialPaths = [
      path.join(__dirname, '../external_ids.json'),
      path.join(__dirname, '../external_ids_uploaded.json'),
      path.join(__dirname, '../../bot-crawls-data/crawled_auctions_1782812838447.json'),
    ];
    for (const p of potentialPaths) {
      if (fs.existsSync(p)) {
        targetFile = p;
        break;
      }
    }
  }

  if (!targetFile || !fs.existsSync(targetFile)) {
    console.log(`⚠️ Không tìm thấy file JSON nguồn ngoài. Tự động sử dụng dải ID chuẩn (1 đến 589.476) để đối soát gap...`);
    return loadExternalIDs(null, 589476);
  }

  console.log(`📂 Đang nạp dữ liệu từ: ${targetFile}`);
  const fileContent = fs.readFileSync(targetFile, 'utf-8');
  let rawData;
  try {
    rawData = JSON.parse(fileContent);
  } catch (err) {
    throw new Error(`File ${targetFile} không đúng định dạng JSON chuẩn!`);
  }

  let rawList = [];
  if (Array.isArray(rawData)) {
    rawList = rawData;
  } else if (typeof rawData === 'object' && rawData !== null) {
    rawList = rawData.items || rawData.data || rawData.ids || rawData.missingIDs || [];
  }

  const rawTotal = rawList.length;
  const parsedIds = rawList.map(item => {
    if (typeof item === 'number') return item;
    if (typeof item === 'string') return parseInt(item, 10);
    if (typeof item === 'object' && item !== null) {
      return item.sourceId || item.id || item.auctionId || item._id;
    }
    return null;
  }).filter(id => typeof id === 'number' && !isNaN(id));

  const uniqueSet = new Set(parsedIds);
  const duplicateCount = parsedIds.length - uniqueSet.size;

  return { ids: Array.from(uniqueSet), rawTotal, duplicateCount, sourceName: path.basename(targetFile) };
}

function findGaps(missingIDs) {
  if (!missingIDs || missingIDs.length === 0) return [];
  const sorted = missingIDs.slice().sort((a, b) => a - b);
  const gaps = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      gaps.push({ start: rangeStart, end: prev, count: prev - rangeStart + 1 });
      rangeStart = curr;
      prev = curr;
    }
  }
  gaps.push({ start: rangeStart, end: prev, count: prev - rangeStart + 1 });
  return gaps;
}

/**
 * Phân tích đối soát chi tiết phân loại dải khuyết (Gap Category Breakdown)
 */
function analyzeGapBreakdown(gaps) {
  const breakdown = {
    singleCount: 0,   // Dải 1 ID
    smallCount: 0,    // Dải 2-10 ID
    mediumCount: 0,   // Dải 11-100 ID
    largeCount: 0,    // Dải > 100 ID
  };

  gaps.forEach(g => {
    if (g.count === 1) breakdown.singleCount++;
    else if (g.count <= 10) breakdown.smallCount++;
    else if (g.count <= 100) breakdown.mediumCount++;
    else breakdown.largeCount++;
  });

  return breakdown;
}

/**
 * Logic tính toán các Trang (Target Pages) tương ứng với danh sách ID thiếu
 * Tối ưu thuật toán Binary Search O(N log P) tránh treo CPU / call stack overflow
 */
async function calculateTargetPages(missingIDs) {
  if (!missingIDs || missingIDs.length === 0) return [];

  const pageDocs = await RawAuctionId.find({ pageNumber: { $gt: 0 } }, { sourceId: 1, pageNumber: 1, _id: 0 }).lean();
  if (pageDocs.length === 0) return [];
  
  const pageMap = new Map();
  pageDocs.forEach(doc => {
    if (!doc.pageNumber || !doc.sourceId) return;
    if (!pageMap.has(doc.pageNumber)) {
      pageMap.set(doc.pageNumber, { page: doc.pageNumber, min: doc.sourceId, max: doc.sourceId });
    } else {
      const p = pageMap.get(doc.pageNumber);
      if (doc.sourceId < p.min) p.min = doc.sourceId;
      if (doc.sourceId > p.max) p.max = doc.sourceId;
    }
  });

  const pageRanges = Array.from(pageMap.values()).sort((a, b) => a.min - b.min);
  const targetPagesSet = new Set();

  for (let i = 0; i < missingIDs.length; i++) {
    const id = missingIDs[i];
    let low = 0;
    let high = pageRanges.length - 1;
    let found = false;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const range = pageRanges[mid];
      if (id >= range.min && id <= range.max) {
        targetPagesSet.add(range.page);
        found = true;
        break;
      } else if (id < range.min) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    if (!found) {
      if (low < pageRanges.length && Math.abs(pageRanges[low].min - id) <= 100) {
        targetPagesSet.add(pageRanges[low].page);
      } else if (high >= 0 && Math.abs(id - pageRanges[high].max) <= 100) {
        targetPagesSet.add(pageRanges[high].page);
      }
    }
  }

  return Array.from(targetPagesSet).sort((a, b) => a - b);
}

async function runComparison(overrideOptions = {}) {
  const options = { ...parseArgs(), ...overrideOptions };


  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   🤖 BOT COMPARE & AUDIT ID ĐẤU GIÁ (ULTRA-DETAILED)    ║');
  console.log('║   Đối soát phân tích chi tiết dữ liệu 2 chiều            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let externalData;
  try {
    externalData = loadExternalIDs(options.file, options.rangeMax);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  }

  await connectDB();
  logSystem(`🔍 Khởi chạy đối soát ID dữ liệu (Nguồn: ${externalData.sourceName})...`);

  console.log('🔍 Đang nạp dữ liệu ID từ MongoDB Local...');

  const localDocs = await RawAuctionId.find({}, { sourceId: 1, _id: 0 }).lean();
  const localIDs = localDocs.map(d => d.sourceId).filter(Boolean);
  const localSet = new Set(localIDs);

  const externalIDs = externalData.ids;
  const externalSet = new Set(externalIDs);

  // Phân tích chỉ số biên Min/Max (Dùng helper loop tránh RangeError call stack overflow khi array lớn)
  function getMinMax(arr) {
    if (!arr || arr.length === 0) return { min: 0, max: 0 };
    let min = arr[0];
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
      const v = arr[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max };
  }

  const { min: minLocal, max: maxLocal } = getMinMax(localIDs);
  const { min: minExt, max: maxExt } = getMinMax(externalIDs);

  console.log(`📊 ĐÃ NẠP & KIỂM ĐỊNH DỮ LIỆU ĐẦU VÀO:`);
  console.log(`   - Local DB: ${localIDs.length.toLocaleString('vi-VN')} IDs [Dải ID: #${minLocal} ➔ #${maxLocal}]`);
  console.log(`   - Nguồn ngoài (${externalData.sourceName}): ${externalSet.size.toLocaleString('vi-VN')} IDs duy nhất [Dải ID: #${minExt} ➔ #${maxExt}]`);
  if (externalData.duplicateCount > 0) {
    console.log(`   ⚠️  Phát hiện ${externalData.duplicateCount.toLocaleString('vi-VN')} ID bị lặp lại trong file nguồn từ máy khác.`);
  }

  // Tính toán Diff 2 chiều
  const matchedIDs = [];
  const missingInLocalIDs = [];
  const extraInLocalIDs = [];

  for (const id of externalSet) {
    if (localSet.has(id)) {
      matchedIDs.push(id);
    } else {
      missingInLocalIDs.push(id);
    }
  }

  for (const id of localSet) {
    if (!externalSet.has(id)) {
      extraInLocalIDs.push(id);
    }
  }

  missingInLocalIDs.sort((a, b) => a - b);
  extraInLocalIDs.sort((a, b) => a - b);
  matchedIDs.sort((a, b) => a - b);

  const gaps = findGaps(missingInLocalIDs);
  const gapBreakdown = analyzeGapBreakdown(gaps);
  const targetPages = await calculateTargetPages(missingInLocalIDs);
  const coverageRate = externalSet.size > 0 ? ((matchedIDs.length / externalSet.size) * 100).toFixed(4) : '0.0000';

  console.log('\n' + '═'.repeat(60));
  console.log('📈 BÁO CÁO ĐỐI SOÁT SIÊU CHI TIẾT (UNCROPPED AUDIT):');
  console.log('═'.repeat(60));
  console.log(`✅ ID Trùng khớp 2 máy:      ${matchedIDs.length.toLocaleString('vi-VN')} IDs (${coverageRate}%)`);
  console.log(`❌ Máy hiện tại đang THIẾU:    ${missingInLocalIDs.length.toLocaleString('vi-VN')} IDs (${gaps.length.toLocaleString('vi-VN')} dải bị khuyết)`);
  console.log(`   ├─ 🔴 Dải đơn (1 ID):     ${gapBreakdown.singleCount.toLocaleString('vi-VN')} dải`);
  console.log(`   ├─ 🟠 Dải nhỏ (2-10 ID):   ${gapBreakdown.smallCount.toLocaleString('vi-VN')} dải`);
  console.log(`   ├─ 🟡 Dải vừa (11-100 ID): ${gapBreakdown.mediumCount.toLocaleString('vi-VN')} dải`);
  console.log(`   └─ 🟣 Dải lớn (>100 ID):   ${gapBreakdown.largeCount.toLocaleString('vi-VN')} dải`);
  console.log(`🎯 Số Trang Target Cần Cào:  ${targetPages.length.toLocaleString('vi-VN')} trang`);
  console.log(`⚠️  Máy hiện tại đang THỪA:    ${extraInLocalIDs.length.toLocaleString('vi-VN')} IDs`);

  if (gaps.length > 0) {
    console.log('\n🔍 Top 5 Dải ID bị khuyết lớn nhất:');
    const sortedGaps = [...gaps].sort((a, b) => b.count - a.count).slice(0, 5);
    sortedGaps.forEach((g, idx) => {
      console.log(`   ${idx + 1}. Dải #${g.start} ➔ #${g.end}: Thiếu ${g.count.toLocaleString('vi-VN')} IDs`);
    });
  }

  // Tùy chọn Sync tự động vào MongoDB
  let syncCount = 0;
  if ((options.sync || options.crawlMissing) && missingInLocalIDs.length > 0) {
    console.log(`\n🔄 Đang tự động Sync ${missingInLocalIDs.length.toLocaleString('vi-VN')} ID thiếu vào MongoDB Local...`);
    const bulkOps = missingInLocalIDs.map(sourceId => ({
      updateOne: {
        filter: { sourceId },
        update: {
          $set: {
            sourceId,
            pageNumber: 0,
            crawledAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    for (let i = 0; i < bulkOps.length; i += 5000) {
      const chunk = bulkOps.slice(i, i + 5000);
      await RawAuctionId.bulkWrite(chunk, { ordered: false });
    }
    syncCount = missingInLocalIDs.length;
    console.log(`✅ Đã Sync thành công ${syncCount.toLocaleString('vi-VN')} ID vào MongoDB!`);
  }

  // Xuất file JSON đối soát chi tiết 100% đầy đủ
  const exportData = {
    generatedAt: new Date(),
    auditSummary: {
      totalLocal: localIDs.length,
      minLocalID: minLocal,
      maxLocalID: maxLocal,
      totalExternalUnique: externalSet.size,
      totalExternalRaw: externalData.rawTotal,
      duplicateExternalIDsInFile: externalData.duplicateCount,
      minExternalID: minExt,
      maxExternalID: maxExt,
      matchedCount: matchedIDs.length,
      coverageRate: `${coverageRate}%`,
      missingInLocalCount: missingInLocalIDs.length,
      extraInLocalCount: extraInLocalIDs.length,
      totalGapRanges: gaps.length,
      targetPagesCount: targetPages.length,
      gapBreakdown,
    },
    targetPages,
    gaps,
    missingIDs: missingInLocalIDs,
    extraIDs: extraInLocalIDs,
  };

  const exportPath = path.join(__dirname, '../missing_ids_export.json');
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
  console.log(`\n📁 Đã xuất toàn bộ dữ liệu đối soát siêu chi tiết ra: ${exportPath}`);

  // Đồng bộ queue sang bot-crawls-data
  const botCrawlsQueuePath = path.join(__dirname, '../../bot-crawls-data/missing_ids_queue.json');
  try {
    fs.writeFileSync(botCrawlsQueuePath, JSON.stringify({ missingIDs: missingInLocalIDs, targetPages, auditSummary: exportData.auditSummary, updatedAt: new Date() }, null, 2), 'utf-8');
    console.log(`🔗 Đã đồng bộ Queue sang bot-crawls-data: ${botCrawlsQueuePath}`);
  } catch (e) { /* ignore */ }

  // Tạo Báo Cáo HTML
  const reportPath = generateCompareHTMLReport({
    totalLocal: localIDs.length,
    totalExternal: externalSet.size,
    matchedCount: matchedIDs.length,
    missingInLocalCount: missingInLocalIDs.length,
    extraInLocalCount: extraInLocalIDs.length,
    missingInLocalIDs,
    extraInLocalIDs,
    gaps,
    targetPages,
    syncCount,
    gapBreakdown,
    externalSource: externalData.sourceName,
  });

  console.log(`🌐 Đã xuất Báo cáo HTML trực quan ra: ${reportPath}`);
  console.log('═'.repeat(60) + '\n');

  logSystem(`🔍 Đã hoàn tất đối soát! Khớp: ${matchedIDs.length.toLocaleString('vi-VN')} | Thiếu: ${missingInLocalIDs.length.toLocaleString('vi-VN')} | Thừa: ${extraInLocalIDs.length.toLocaleString('vi-VN')} | Trang Target: ${targetPages.length}`);

  if (options.crawlMissing) {
    logSystem(`🚀 Kích hoạt bot cào mục tiêu cho ${targetPages.length} trang chứa ID thiếu...`);
    console.log(`🚀 KÍCH HOẠT BOT CÀO MỤC TIÊU CHO CÁC ID THIẾU...`);
    const { runCrawl } = require('./crawler');
    await runCrawl({ missingOnly: true, targetPages });
  }

  if (require.main === module) {
    await closeDB({ force: true });
  }
}

if (require.main === module) {
  runComparison().catch(err => {
    console.error('❌ Lỗi xử lý:', err);
    process.exit(1);
  });
}


module.exports = { runComparison, loadExternalIDs, findGaps, calculateTargetPages, analyzeGapBreakdown };
