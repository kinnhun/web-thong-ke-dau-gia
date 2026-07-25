const fs = require('fs');
const path = require('path');

function generateCompareHTMLReport(data) {
  const {
    totalLocal = 0,
    totalExternal = 0,
    matchedCount = 0,
    missingInLocalCount = 0,
    extraInLocalCount = 0,
    missingInLocalIDs = [],
    extraInLocalIDs = [],
    gaps = [],
    targetPages = [],
    syncCount = 0,
    externalSource = 'File Dữ Liệu Máy Khác',
    generatedAt = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
  } = data;

  const matchRate = totalExternal > 0 ? ((matchedCount / totalExternal) * 100).toFixed(2) : '0.00';
  const missingRate = totalExternal > 0 ? ((missingInLocalCount / totalExternal) * 100).toFixed(2) : '0.00';

  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo So Sánh Đối Soát ID Đấu Giá - Đầy Đủ 100%</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.75);
      --card-border: rgba(255, 255, 255, 0.1);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0284c7;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --purple: #a855f7;
      --purple-hover: #9333ea;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 24px;
    }
    .container { max-width: 1350px; margin: 0 auto; }
    
    /* Top Navigation Tabs */
    .nav-tabs {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 12px;
    }
    .nav-tab {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-muted);
      text-decoration: none;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      transition: all 0.2s;
    }
    .nav-tab:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
    .nav-tab.active { background: var(--accent); color: #0f172a; border-color: var(--accent); font-weight: 700; }
    
    header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    h1 { font-size: 1.75rem; font-weight: 700; color: var(--accent); display: flex; align-items: center; gap: 10px; }
    .subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 4px; }
    
    .action-bar {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }
    
    .btn {
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }
    .btn-accent { background: var(--accent); color: #0f172a; }
    .btn-accent:hover { background: var(--accent-hover); color: #fff; }
    .btn-success { background: var(--success); color: #fff; }
    .btn-purple { background: var(--purple); color: #fff; }
    .btn-purple:hover { background: var(--purple-hover); }
    .btn-outline { background: rgba(255,255,255,0.05); color: var(--text); border: 1px solid var(--card-border); }
    .btn-outline:hover { background: rgba(255,255,255,0.15); }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
      backdrop-filter: blur(12px);
    }
    .card-title { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .card-val { font-size: 1.8rem; font-weight: 700; margin-top: 6px; }
    .val-local { color: var(--accent); }
    .val-ext { color: var(--purple); }
    .val-match { color: var(--success); }
    .val-missing { color: var(--danger); }
    .val-extra { color: var(--warning); }
    
    .section-title {
      font-size: 1.15rem;
      margin: 24px 0 12px;
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-weight: 600;
    }
    .badge {
      font-size: 0.75rem;
      padding: 3px 10px;
      border-radius: 999px;
      font-weight: 700;
    }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: var(--danger); border: 1px solid var(--danger); }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: var(--warning); border: 1px solid var(--warning); }
    .badge-info { background: rgba(56, 189, 248, 0.2); color: var(--accent); border: 1px solid var(--accent); }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: var(--success); border: 1px solid var(--success); }
    
    .table-container {
      overflow-x: auto;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      margin-bottom: 24px;
      max-height: 500px;
      overflow-y: auto;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
    th, td { padding: 12px 16px; border-bottom: 1px solid var(--card-border); }
    th { background: rgba(15, 23, 42, 0.95); color: var(--text-muted); font-weight: 600; position: sticky; top: 0; z-index: 10; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: rgba(255, 255, 255, 0.05); }
    
    .ids-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-height: 400px;
      overflow-y: auto;
      padding: 16px;
      background: rgba(15, 23, 42, 0.6);
      border-radius: 12px;
      border: 1px solid var(--card-border);
    }
    .id-pill {
      font-family: monospace;
      font-size: 0.85rem;
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
    }
    .pill-missing { border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; }
    .pill-extra { border-color: rgba(245, 158, 11, 0.4); color: #fde68a; }

    .search-input {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--card-border);
      background: rgba(15, 23, 42, 0.8);
      color: var(--text);
      font-size: 0.85rem;
      outline: none;
      width: 220px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Navigation Tabs -->
    <div class="nav-tabs">
      <a href="/" class="nav-tab">📊 Tiến Độ Cào 589.476 IDs</a>
      <a href="/compare" class="nav-tab active">🔍 Đối Soát & So Sánh ID (Compare Bot)</a>
    </div>

    <header>
      <div>
        <h1>🔍 Báo Cáo Đối Soát So Sánh ID <span class="badge badge-info">100% Uncropped Engine</span></h1>
        <div class="subtitle">Nguồn So Sánh: <strong>${externalSource}</strong> | Thời gian cập nhật: <span id="lblTime">${generatedAt}</span></div>
      </div>
      <div id="syncBadge">
        ${syncCount > 0 ? `<div class="badge badge-success">🔄 Đã Auto-Sync ${syncCount.toLocaleString('vi-VN')} ID Vào MongoDB Local</div>` : ''}
      </div>
    </header>

    <!-- Action Bar -->
    <div class="action-bar">
      <div style="display:flex; gap:10px; align-items:center;">
        <label class="btn btn-outline" style="cursor:pointer;">
          📂 Chọn File JSON Từ Máy Khác
          <input type="file" id="fileInput" accept=".json" style="display:none;">
        </label>
        <span id="fileNameDisplay" style="color:var(--text-muted); font-size:0.85rem;">Chưa chọn file mới</span>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <a href="/api/download-missing-json" class="btn btn-outline" download>📥 Tải File JSON ID Thiếu Full</a>
        <button id="btnCrawlMissing" class="btn btn-purple">🚀 Cào Các ID Thiếu</button>
        <button id="btnRunSync" class="btn btn-success">⚡ Sync ID Thiếu Vào MongoDB</button>
        <button id="btnRefresh" class="btn btn-accent">🔄 Tải Lại Báo Cáo</button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="card">
        <div class="card-title">DB Hiện Tại (Local DB)</div>
        <div class="card-val val-local">${totalLocal.toLocaleString('vi-VN')} <span style="font-size:0.9rem">IDs</span></div>
      </div>
      <div class="card">
        <div class="card-title">Nguồn Máy Khác (External)</div>
        <div class="card-val val-ext">${totalExternal.toLocaleString('vi-VN')} <span style="font-size:0.9rem">IDs</span></div>
      </div>
      <div class="card">
        <div class="card-title">ID Trùng Khớp</div>
        <div class="card-val val-match">${matchedCount.toLocaleString('vi-VN')} <span style="font-size:0.9rem">(${matchRate}%)</span></div>
      </div>
      <div class="card">
        <div class="card-title">Local Đang THIẾU</div>
        <div class="card-val val-missing">${missingInLocalCount.toLocaleString('vi-VN')} <span style="font-size:0.9rem">(${missingRate}%)</span></div>
      </div>
      <div class="card">
        <div class="card-title">Số Trang Cần Cào Bù</div>
        <div class="card-val val-extra">${targetPages.length.toLocaleString('vi-VN')} <span style="font-size:0.9rem">Trang Target</span></div>
      </div>
    </div>

    <!-- DẢI KHUYẾT (GAPS) - FULL 100% UNCROPPED LIST -->
    <div class="section-title">
      <div>
        🔍 Phân Tích Tất Cả Dải ID Bị Khuyết (Gaps) 
        <span class="badge badge-danger">${gaps.length.toLocaleString('vi-VN')} Dải Khuyết</span>
        <span class="badge badge-info">Target: ${targetPages.length.toLocaleString('vi-VN')} Trang</span>
      </div>
      <input type="text" id="gapSearch" class="search-input" placeholder="Lọc dải ID (VD: 593636)...">
    </div>
    <div class="table-container">
      <table id="gapsTable">
        <thead>
          <tr>
            <th># STT</th>
            <th>ID Bắt Đầu (Start)</th>
            <th>ID Kết Thúc (End)</th>
            <th>Số Lượng ID Thiếu</th>
            <th>Mô Tả Phạm Vi</th>
          </tr>
        </thead>
        <tbody id="gapsTbody">
          ${gaps.length === 0 ? '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Không phát hiện dải ID bị khuyết!</td></tr>' : 
            gaps.map((g, idx) => `
              <tr class="gap-row" data-start="${g.start}" data-end="${g.end}">
                <td>#${idx + 1}</td>
                <td><strong style="color:var(--accent); font-family:monospace;">${g.start}</strong></td>
                <td><strong style="color:var(--accent); font-family:monospace;">${g.end}</strong></td>
                <td><span class="badge badge-danger">${g.count.toLocaleString('vi-VN')} IDs</span></td>
                <td>Dải ID #${g.start} ➔ #${g.end}</td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    </div>

    <!-- ID THIẾU - FULL 100% UNCROPPED LIST -->
    <div class="section-title">
      <div>
        ❌ Danh Sách Tất Cả ID Máy Hiện Tại Đang THIẾU (${missingInLocalCount.toLocaleString('vi-VN')} IDs - Đầy đủ 100%)
      </div>
      <input type="text" id="missingSearch" class="search-input" placeholder="Lọc mã ID thiếu...">
    </div>
    <div class="ids-grid" id="missingGrid">
      ${missingInLocalIDs.length === 0 ? '<div style="color: var(--text-muted);">Không có ID nào bị thiếu!</div>' : 
        missingInLocalIDs.map(id => `<span class="id-pill pill-missing missing-item" data-id="${id}">ID #${id}</span>`).join('')
      }
    </div>

    <!-- ID THỪA - FULL 100% UNCROPPED LIST -->
    <div class="section-title" style="margin-top: 28px;">
      <div>
        ⚠️ Danh Sách Tất Cả ID Máy Hiện Tại Đang THỪA (${extraInLocalCount.toLocaleString('vi-VN')} IDs - Đầy đủ 100%)
      </div>
      <input type="text" id="extraSearch" class="search-input" placeholder="Lọc mã ID thừa...">
    </div>
    <div class="ids-grid" id="extraGrid">
      ${extraInLocalIDs.length === 0 ? '<div style="color: var(--text-muted);">Không có ID dư thừa!</div>' : 
        extraInLocalIDs.map(id => `<span class="id-pill pill-extra extra-item" data-id="${id}">ID #${id}</span>`).join('')
      }
    </div>
  </div>

  <script>
    document.getElementById('btnRefresh').addEventListener('click', () => { window.location.reload(); });

    // Lọc dải khuyết (Gaps) realtime
    document.getElementById('gapSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const rows = document.querySelectorAll('.gap-row');
      rows.forEach(r => {
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
      });
    });

    // Lọc ID thiếu realtime
    document.getElementById('missingSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const items = document.querySelectorAll('.missing-item');
      items.forEach(item => {
        item.style.display = item.dataset.id.includes(q) ? '' : 'none';
      });
    });

    // Lọc ID thừa realtime
    document.getElementById('extraSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const items = document.querySelectorAll('.extra-item');
      items.forEach(item => {
        item.style.display = item.dataset.id.includes(q) ? '' : 'none';
      });
    });

    // Đọc file JSON từ trình duyệt để đối soát trực tiếp
    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('fileNameDisplay').innerText = file.name;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsedData = JSON.parse(event.target.result);
          const res = await fetch('/api/compare-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedData)
          });
          const data = await res.json();
          if (data.success) {
            alert('✅ Đối soát thành công với file ' + file.name + '!\nĐang tải lại giao diện...');
            window.location.reload();
          } else {
            alert('❌ Lỗi đối soát: ' + data.message);
          }
        } catch (err) {
          alert('❌ File không hợp lệ: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Kích hoạt Sync ID thiếu
    document.getElementById('btnRunSync').addEventListener('click', async () => {
      if (confirm('Bạn có muốn tự động Sync toàn bộ ID bị thiếu vào MongoDB local không?')) {
        try {
          const res = await fetch('/api/compare-sync', { method: 'POST' });
          const data = await res.json();
          alert(data.message);
          window.location.reload();
        } catch (err) {
          alert('Lỗi Sync: ' + err.message);
        }
      }
    });

    // Kích hoạt Cào Các ID Thiếu (Run Targeted Missing Crawler)
    document.getElementById('btnCrawlMissing').addEventListener('click', async () => {
      if (confirm('🚀 Bạn có muốn tự động Sync và KÍCH HOẠT BOT CÀO MỤC TIÊU cho các ID bị thiếu trong background không?')) {
        try {
          const res = await fetch('/api/trigger-crawl-missing', { method: 'POST' });
          const data = await res.json();
          alert(data.message);
          window.location.reload();
        } catch (err) {
          alert('Lỗi kích hoạt cào: ' + err.message);
        }
      }
    });
  </script>
</body>
</html>`;

  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const reportPath = path.join(publicDir, 'compare-report.html');
  fs.writeFileSync(reportPath, htmlContent, 'utf-8');
  return reportPath;
}

module.exports = { generateCompareHTMLReport };
