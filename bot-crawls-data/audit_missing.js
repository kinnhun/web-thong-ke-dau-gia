/**
 * audit_missing.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tool kiểm tra thiếu / thừa tài sản đấu giá giữa local DB và web dgts.moj.gov.vn
 *
 * Cách dùng:
 *   node audit_missing.js                          # Kiểm tra toàn bộ
 *   node audit_missing.js --org "Trung tâm TPHCM"  # Lọc theo tên tổ chức (chứa)
 *   node audit_missing.js --orgId 12345             # Lọc theo ID tổ chức
 *   node audit_missing.js --pageSize 200            # Số bản ghi/trang (max 200)
 *   node audit_missing.js --out report.html         # Tên file output (mặc định: audit_report_<date>.html)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { initBrowser, fetchAPI, closeBrowser } = require('./src/browser');
const AuctionNotice = require('./src/models/AuctionNotice');
const config = require('./src/config');

// ─── Parse CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
}
const ORG_NAME_FILTER = getArg('--org') || null;
const ORG_ID_FILTER   = getArg('--orgId') ? Number(getArg('--orgId')) : null;
const PAGE_SIZE       = Math.min(Number(getArg('--pageSize') || 100), 200);
const OUT_FILE        = getArg('--out') || `audit_report_${new Date().toISOString().slice(0, 10)}.html`;
const API_DELAY_MS    = 300; // ms giữa mỗi trang API

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fmt(n) {
  return n.toLocaleString('vi-VN');
}

function pct(a, b) {
  if (b === 0) return '0%';
  return ((a / b) * 100).toFixed(2) + '%';
}

// ─── Bước 1: Lấy tổng + toàn bộ sourceId từ Web ────────────────────────────
async function fetchAllWebIds(apiParams) {
  console.log('\n📡 Bước 1/3: Đang lấy danh sách sourceId từ web...');

  // Lấy trang đầu để biết tổng số trang
  const firstRes = await fetchAPI(config.endpoints.auctionNoticeList, {
    p: 1,
    numberPerPage: PAGE_SIZE,
    typeOrder: 2,
    ...apiParams,
  });

  if (!firstRes || !firstRes.items) {
    throw new Error('Không thể kết nối API web. Hãy chắc chắn browser đã pass FEC challenge.');
  }

  const totalItems = firstRes.totalItem || firstRes.rowCount || 0;
  const totalPages = firstRes.pageCount || 1;

  console.log(`   Web báo: ${fmt(totalItems)} bản ghi, ${fmt(totalPages)} trang (${PAGE_SIZE} bản/trang)`);

  const webIds = new Set();

  // Chuẩn bị Regex lọc theo tổ chức đấu giá (in-memory) nếu có filter
  let orgRegex = null;
  if (ORG_NAME_FILTER) {
    const escapedTerms = ORG_NAME_FILTER.split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    orgRegex = new RegExp(escapedTerms.join('.*'), 'i');
  }

  // Thu thập từ trang đầu
  for (const item of firstRes.items) {
    if (item.id) {
      if (orgRegex) {
        if (item.org_name && orgRegex.test(item.org_name)) {
          webIds.add(Number(item.id));
        }
      } else {
        webIds.add(Number(item.id));
      }
    }
  }

  // Thu thập các trang tiếp theo
  for (let page = 2; page <= totalPages; page++) {
    await sleep(API_DELAY_MS);

    if (page % 50 === 0 || page === totalPages) {
      const pctDone = ((page / totalPages) * 100).toFixed(1);
      process.stdout.write(`\r   Trang ${fmt(page)}/${fmt(totalPages)} (${pctDone}%) — đã thu ${fmt(webIds.size)} IDs   `);
    }

    try {
      const res = await fetchAPI(config.endpoints.auctionNoticeList, {
        p: page,
        numberPerPage: PAGE_SIZE,
        typeOrder: 2,
        ...apiParams,
      });

      if (res && res.items) {
        for (const item of res.items) {
          if (item.id) {
            if (orgRegex) {
              if (item.org_name && orgRegex.test(item.org_name)) {
                webIds.add(Number(item.id));
              }
            } else {
              webIds.add(Number(item.id));
            }
          }
        }
      }
    } catch (err) {
      console.warn(`\n   ⚠️  Lỗi trang ${page}: ${err.message} — bỏ qua`);
    }
  }

  console.log(`\n   ✅ Thu thập xong: ${fmt(webIds.size)} sourceId duy nhất từ web (sau khi lọc)`);

  return { webIds, totalItems, totalPages };
}

// ─── Bước 2: Lấy toàn bộ sourceId từ Local DB ───────────────────────────────
async function fetchAllLocalIds(dbQuery) {
  console.log('\n🗄️  Bước 2/3: Đang lấy sourceId từ local DB...');

  const localDocs = await AuctionNotice
    .find(dbQuery, { sourceId: 1 })
    .lean();

  const localIds = new Set();
  for (const doc of localDocs) {
    if (doc.sourceId) {
      localIds.add(Number(doc.sourceId));
    }
  }

  console.log(`   ✅ Local DB: ${fmt(localIds.size)} bản ghi`);
  return localIds;
}

// ─── Bước 3: So sánh 2 chiều ─────────────────────────────────────────────────
function compareSets(webIds, localIds) {
  console.log('\n🔍 Bước 3/3: Đang so sánh 2 chiều...');

  const missing = []; // Có trên web, KHÔNG có local
  const extra   = []; // Có trên local, KHÔNG có trên web

  for (const id of webIds) {
    if (!localIds.has(id)) {
      missing.push(id);
    }
  }

  for (const id of localIds) {
    if (!webIds.has(id)) {
      extra.push(id);
    }
  }

  console.log(`   📉 THIẾU (có trên web, không có local): ${fmt(missing.length)}`);
  console.log(`   📈 THỪA  (có trên local, không có web): ${fmt(extra.length)}`);

  return { missing, extra };
}

// ─── Render HTML report ───────────────────────────────────────────────────────
function buildHtmlReport({ webCount, localCount, missing, extra, filterLabel, generatedAt }) {
  const MAX_DISPLAY_IDS = 1000;

  const tableRows = (rows, cols) => {
    if (rows.length === 0) return '<tr><td colspan="' + cols + '" style="text-align:center;color:#888">Không có</td></tr>';
    return rows.map(r => '<tr>' + r + '</tr>').join('');
  };

  const missingRows = tableRows(
    missing.slice(0, MAX_DISPLAY_IDS).map(id => `<td>${id}</td><td><a href="https://dgts.moj.gov.vn/thong-bao-cong-khai-viec-dau-gia.html?id=${id}" target="_blank">#${id}</a></td>`),
    2
  ) + (missing.length > MAX_DISPLAY_IDS ? `<tr><td colspan="2" style="text-align:center;color:#e53e3e;font-weight:bold;">... Và ${fmt(missing.length - MAX_DISPLAY_IDS)} ID khác (không hiển thị hết)</td></tr>` : '');

  const extraRows = tableRows(
    extra.slice(0, MAX_DISPLAY_IDS).map(id => `<td>${id}</td><td><a href="https://dgts.moj.gov.vn/thong-bao-cong-khai-viec-dau-gia.html?id=${id}" target="_blank">#${id}</a></td>`),
    2
  ) + (extra.length > MAX_DISPLAY_IDS ? `<tr><td colspan="2" style="text-align:center;color:#dd6b20;font-weight:bold;">... Và ${fmt(extra.length - MAX_DISPLAY_IDS)} ID khác (không hiển thị hết)</td></tr>` : '');

  const overlapCount = localCount - extra.length;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Báo Cáo Kiểm Toán Dữ Liệu Đấu Giá</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f0f2f5; color: #222; line-height: 1.6; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px 16px; }

  /* Header */
  .header { background: linear-gradient(135deg, #0d1f3c 0%, #1a3a6e 100%); color: white; border-radius: 16px; padding: 32px; margin-bottom: 24px; }
  .header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 8px; }
  .header p  { opacity: .75; font-size: .9rem; }
  .filter-tag { display: inline-block; background: rgba(255,255,255,.15); border-radius: 20px; padding: 4px 14px; font-size: .8rem; margin-top: 10px; }

  /* Stats cards */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .stat-card .label { font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; color: #888; margin-bottom: 4px; }
  .stat-card .value { font-size: 2rem; font-weight: 700; line-height: 1; }
  .stat-card .sub   { font-size: .75rem; color: #888; margin-top: 4px; }
  .red   .value { color: #e53e3e; }
  .orange .value { color: #dd6b20; }
  .green  .value { color: #38a169; }
  .blue   .value { color: #3182ce; }
  .purple .value { color: #805ad5; }

  /* Section */
  .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .section h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .pill { font-size: .7rem; background: #edf2ff; color: #3182ce; border-radius: 20px; padding: 2px 10px; font-weight: 600; }
  .pill.red { background: #fff5f5; color: #e53e3e; }
  .pill.orange { background: #fffaf0; color: #dd6b20; }

  /* Table */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: .85rem; }
  th { background: #f7f9fc; text-align: left; padding: 10px 12px; font-weight: 600; color: #555; border-bottom: 2px solid #e8ecf0; white-space: nowrap; }
  td { padding: 9px 12px; border-bottom: 1px solid #f0f2f5; vertical-align: top; }
  tr:hover td { background: #fafbff; }
  a { color: #3182ce; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Badge */
  .badge { font-size: .7rem; padding: 2px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap; }

  /* Summary box */
  .summary { background: #f7f9fc; border-left: 4px solid #3182ce; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 20px; font-size: .9rem; }
  .summary strong { display: block; margin-bottom: 6px; font-size: 1rem; }

  /* Footer */
  .footer { text-align: center; color: #aaa; font-size: .8rem; margin-top: 32px; }
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div class="header">
    <h1>📊 Báo Cáo Kiểm Toán Dữ Liệu Đấu Giá</h1>
    <p>So sánh ID giữa local MongoDB và <strong>dgts.moj.gov.vn</strong></p>
    ${filterLabel ? `<span class="filter-tag">🔍 Lọc: ${filterLabel}</span>` : '<span class="filter-tag">🌐 Toàn bộ</span>'}
    <p style="margin-top:10px; opacity:.6; font-size:.8rem">Tạo lúc: ${generatedAt}</p>
  </div>

  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-card blue">
      <div class="label">Web khớp filter</div>
      <div class="value">${fmt(webCount)}</div>
      <div class="sub">bản ghi trên dgts.moj.gov.vn</div>
    </div>
    <div class="stat-card blue">
      <div class="label">Local khớp filter</div>
      <div class="value">${fmt(localCount)}</div>
      <div class="sub">bản ghi trong MongoDB</div>
    </div>
    <div class="stat-card green">
      <div class="label">Trùng khớp</div>
      <div class="value">${fmt(overlapCount)}</div>
      <div class="sub">${pct(overlapCount, webCount)} so với web</div>
    </div>
    <div class="stat-card red">
      <div class="label">📉 THIẾU ở local</div>
      <div class="value">${fmt(missing.length)}</div>
      <div class="sub">${pct(missing.length, webCount)} so với web</div>
    </div>
    <div class="stat-card orange">
      <div class="label">📈 THỪA ở local</div>
      <div class="value">${fmt(extra.length)}</div>
      <div class="sub">${pct(extra.length, localCount)} so với local</div>
    </div>
  </div>

  <!-- Summary -->
  <div class="section">
    <div class="summary">
      <strong>💡 Phân tích tóm tắt</strong>
      ${missing.length > 0
        ? `<span style="color:#e53e3e">⚠️ Có <strong>${fmt(missing.length)}</strong> ID tài sản tồn tại trên web nhưng <strong>chưa có trong local DB</strong>.</span>`
        : '<span style="color:#38a169">✅ Không phát hiện ID tài sản nào bị thiếu (local đã có đủ so với web).</span>'
      }
      <br>
      ${extra.length > 0
        ? `<span style="color:#dd6b20">⚠️ Có <strong>${fmt(extra.length)}</strong> ID tài sản trong local <strong>không còn xuất hiện trên danh sách web</strong> (có thể đã bị gỡ hoặc lỗi đồng bộ).</span>`
        : '<span style="color:#38a169">✅ Không có ID thừa nào trong local DB.</span>'
      }
    </div>
  </div>

  <!-- THIẾU -->
  <div class="section">
    <h2>📉 ID tài sản THIẾU ở local <span class="pill red">${fmt(missing.length)}</span></h2>
    <p style="color:#888; font-size:.85rem; margin-bottom:16px">
      Các sourceId này tồn tại trên web nhưng không có trong local DB.
      ${missing.length > MAX_DISPLAY_IDS ? `Chỉ hiển thị tối đa ${MAX_DISPLAY_IDS} ID đầu tiên.` : ''}
    </p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Source ID</th><th>Xem chi tiết trên web</th></tr>
        </thead>
        <tbody>${missingRows}</tbody>
      </table>
    </div>
  </div>

  <!-- THỪA -->
  <div class="section">
    <h2>📈 ID tài sản THỪA ở local <span class="pill orange">${fmt(extra.length)}</span></h2>
    <p style="color:#888; font-size:.85rem; margin-bottom:16px">
      Các ID này có trong local DB nhưng không còn xuất hiện trên danh sách tìm kiếm của web.
      ${extra.length > MAX_DISPLAY_IDS ? `Chỉ hiển thị tối đa ${MAX_DISPLAY_IDS} ID đầu tiên.` : ''}
    </p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Source ID</th><th>Link tham chiếu web gốc</th></tr>
        </thead>
        <tbody>${extraRows}</tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <p>Dữ liệu audit được tạo tự động bởi <code>audit_missing.js</code> — ${generatedAt}</p>
  </div>
</div>
</body>
</html>`;
}

// ─── Render Markdown summary (hiển thị trên terminal) ────────────────────────
function printMarkdownSummary({ webCount, localCount, missing, extra, filterLabel }) {
  const hr = '─'.repeat(60);
  console.log(`\n${hr}`);
  console.log('📊  KẾT QUẢ KIỂM TOÁN DỮ LIỆU ĐẤU GIÁ');
  if (filterLabel) console.log(`🔍  Bộ lọc: ${filterLabel}`);
  console.log(hr);
  console.log(`🌐  Web (dgts.moj.gov.vn)  : ${fmt(webCount).padStart(10)} bản ghi`);
  console.log(`🗄️   Local MongoDB           : ${fmt(localCount).padStart(10)} bản ghi`);
  console.log(`✅  Trùng khớp              : ${fmt(localCount - extra.length).padStart(10)} bản ghi`);
  console.log(`📉  THIẾU ở local           : ${fmt(missing.length).padStart(10)} bản ghi  (${pct(missing.length, webCount)} của web)`);
  console.log(`📈  THỪA  ở local           : ${fmt(extra.length).padStart(10)} bản ghi  (${pct(extra.length, localCount)} của local)`);
  console.log(hr);

  if (missing.length > 0 && missing.length <= 100) {
    console.log('\n📉 Danh sách sourceId THIẾU:');
    const cols = 10;
    for (let i = 0; i < missing.length; i += cols) {
      console.log('  ' + missing.slice(i, i + cols).join(', '));
    }
  } else if (missing.length > 100) {
    console.log(`\n📉 ${fmt(missing.length)} ID thiếu — xem chi tiết trong file HTML.`);
  }

  if (extra.length > 0 && extra.length <= 100) {
    console.log('\n📈 Danh sách sourceId THỪA:');
    const cols = 10;
    for (let i = 0; i < extra.length; i += cols) {
      console.log('  ' + extra.slice(i, i + cols).join(', '));
    }
  } else if (extra.length > 100) {
    console.log(`\n📈 ${fmt(extra.length)} bản ghi thừa — xem chi tiết trong file HTML.`);
  }

  console.log(`\n${hr}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       AUDIT TOOL — Kiểm tra thiếu/thừa tài sản          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n⚙️  Cấu hình:`);
  console.log(`   PAGE_SIZE : ${PAGE_SIZE}`);
  console.log(`   ORG_NAME  : ${ORG_NAME_FILTER || '(không lọc)'}`);
  console.log(`   ORG_ID    : ${ORG_ID_FILTER   || '(không lọc)'}`);
  console.log(`   OUTPUT    : ${OUT_FILE}`);
  console.log('');

  // Kết nối DB
  console.log('🔌 Kết nối MongoDB...');
  await mongoose.connect(config.mongo.uri);
  console.log('   ✅ Kết nối thành công');

  // Xây dựng params API & DB query theo filter
  const apiParams = {};
  const dbQuery   = {};
  let filterLabel = null;

  if (ORG_ID_FILTER) {
    apiParams.orgId = ORG_ID_FILTER;
    filterLabel = `orgId = ${ORG_ID_FILTER}`;
  }
  if (ORG_NAME_FILTER) {
    const escapedTerms = ORG_NAME_FILTER.split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const fuzzyPattern = escapedTerms.join('.*');
    dbQuery.organizer = { $regex: fuzzyPattern, $options: 'i' };
    filterLabel = `Tổ chức chứa "${ORG_NAME_FILTER}" (fuzzy matching)`;
    apiParams.orgName = ORG_NAME_FILTER;
  }

  // Khởi tạo browser (bypass FEC)
  console.log('\n🌐 Khởi tạo Puppeteer browser...');
  await initBrowser();

  let webIds;
  try {
    const webResult = await fetchAllWebIds(apiParams);
    webIds         = webResult.webIds;
  } catch (err) {
    console.error('\n❌ Lỗi khi lấy dữ liệu từ web:', err.message);
    await closeBrowser();
    await mongoose.disconnect();
    process.exit(1);
  }

  await closeBrowser();

  // Lấy local IDs
  const localIds = await fetchAllLocalIds(dbQuery);

  // So sánh
  const { missing, extra } = compareSets(webIds, localIds);

  // In Markdown summary ra terminal
  printMarkdownSummary({
    webCount:   webIds.size,
    localCount: localIds.size,
    missing,
    extra,
    filterLabel,
  });

  // Render & lưu HTML report
  const html = buildHtmlReport({
    webCount:    webIds.size,
    localCount:  localIds.size,
    missing,
    extra,
    filterLabel,
    generatedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
  });

  const outPath = path.resolve(__dirname, OUT_FILE);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`\n✅ Báo cáo HTML đã lưu tại:\n   ${outPath}`);
  console.log('   Mở file này bằng trình duyệt để xem chi tiết.');

  await mongoose.disconnect();
  console.log('\n👋 Hoàn tất.\n');
}

main().catch(err => {
  console.error('\n❌ Lỗi nghiêm trọng:', err.message);
  closeBrowser().catch(() => {});
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
