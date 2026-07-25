const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { connectDB } = require('./db');
const { getAuditStats, getPaginatedIDs } = require('./reporter');
const { runCrawl } = require('./crawler');
const { runComparison } = require('./compare');
const { logSystem } = require('./logger');


async function main() {
  await connectDB();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Phục vụ giao diện tĩnh public
  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/report.html'));
  });

  app.get('/compare', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/compare-report.html'));
  });

  app.get('/compare-report.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/compare-report.html'));
  });

  // API thống kê tiến độ
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await getAuditStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: true, message: err.message });
    }
  });

  // API tải xuống file JSON các ID bị thiếu
  app.get('/api/download-missing-json', (req, res) => {
    const exportPath = path.join(__dirname, '../missing_ids_export.json');
    if (!fs.existsSync(exportPath)) {
      return res.status(404).json({ error: true, message: 'Chưa có file missing_ids_export.json. Hãy chạy đối soát trước!' });
    }
    res.download(exportPath, 'missing_ids_export.json');
  });

  // API đọc log chi tiết từng lần gọi API
  app.get('/api/logs', (req, res) => {
    try {
      const { apiLogFile } = require('./logger');
      if (!fs.existsSync(apiLogFile)) {
        return res.json({ logs: ['Chưa có log API call nào.'] });
      }
      const lines = fs.readFileSync(apiLogFile, 'utf-8').trim().split('\n');
      const limit = parseInt(req.query.limit || '100', 10);
      const recentLogs = lines.slice(-limit).reverse();
      res.json({ totalLogs: lines.length, logs: recentLogs });
    } catch (err) {
      res.status(500).json({ error: true, message: err.message });
    }
  });

  // API lấy danh sách IDs phân trang
  app.get('/api/ids', async (req, res) => {
    try {
      const result = await getPaginatedIDs(req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: true, message: err.message });
    }
  });

  // API kích hoạt cào mới hoặc retry
  app.post('/api/trigger-crawl', (req, res) => {
    logSystem('🚀 Nhận lệnh kích hoạt Bot cào dữ liệu mới từ giao diện web...');
    runCrawl().catch(err => logSystem(`❌ Lỗi cào dữ liệu: ${err.message}`));
    res.json({ success: true, message: '🚀 Đã kích hoạt bot cào dữ liệu trong background!' });
  });

  app.post('/api/trigger-retry', (req, res) => {
    logSystem('⚡ Nhận lệnh kích hoạt cào lại các trang bị lỗi từ giao diện web...');
    runCrawl({ retryOnly: true }).catch(err => logSystem(`❌ Lỗi cào lại: ${err.message}`));
    res.json({ success: true, message: '⚡ Đã kích hoạt cào lại các trang lỗi!' });
  });

  // API Kích hoạt đối soát ID trực tiếp
  app.post('/api/trigger-compare', async (req, res) => {
    try {
      logSystem('🔍 Nhận lệnh kích hoạt Đối Soát ID từ giao diện web...');
      runComparison().catch(err => logSystem(`❌ Lỗi chạy đối soát: ${err.message}`));
      res.json({ success: true, message: '🔍 Đã kích hoạt bot đối soát ID dữ liệu trong background!' });
    } catch (err) {
      logSystem(`❌ Lỗi API đối soát: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API kích hoạt Sync ID thiếu từ file export
  app.post('/api/compare-sync', async (req, res) => {
    try {
      logSystem('⚡ Nhận lệnh kích hoạt Sync ID thiếu vào MongoDB...');
      const exportPath = path.join(__dirname, '../missing_ids_export.json');
      if (!fs.existsSync(exportPath)) {
        return res.status(400).json({ success: false, message: 'Chưa có dữ liệu ID thiếu. Hãy chạy đối soát trước!' });
      }
      const raw = fs.readFileSync(exportPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const missingIDs = parsed.missingIDs || [];

      if (missingIDs.length === 0) {
        logSystem('ℹ️ Không có ID thiếu nào cần Sync.');
        return res.json({ success: true, message: 'Không có ID thiếu nào cần Sync!' });
      }

      logSystem(`🔄 Đang tiến hành Sync ${missingIDs.length.toLocaleString('vi-VN')} ID thiếu vào MongoDB Local...`);
      const RawAuctionId = require('./models/RawAuctionId');
      const bulkOps = missingIDs.map(sourceId => ({
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

      logSystem(`✅ Đã Sync thành công ${missingIDs.length.toLocaleString('vi-VN')} ID thiếu vào MongoDB!`);
      res.json({ success: true, message: `Đã Sync thành công ${missingIDs.length.toLocaleString('vi-VN')} ID vào MongoDB!` });
    } catch (err) {
      logSystem(`❌ Lỗi Sync ID thiếu: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API Kích hoạt cào mục tiêu các ID bị thiếu
  app.post('/api/trigger-crawl-missing', async (req, res) => {
    try {
      logSystem('🚀 Nhận lệnh KÍCH HOẠT BOT CÀO MỤC TIÊU CÁC ID THIẾU từ giao diện web...');
      const exportPath = path.join(__dirname, '../missing_ids_export.json');
      let missingCount = 0;
      let targetPages = [];

      if (fs.existsSync(exportPath)) {
        const raw = fs.readFileSync(exportPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const missingIDs = parsed.missingIDs || [];
        missingCount = missingIDs.length;
        targetPages = parsed.targetPages || [];

        if (missingIDs.length > 0) {
          logSystem(`🔄 Auto-sync ${missingIDs.length} ID thiếu vào DB trước khi cào...`);
          const RawAuctionId = require('./models/RawAuctionId');
          const bulkOps = missingIDs.map(sourceId => ({
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
        }
      }

      logSystem(`🚀 Khởi chạy bot cào mục tiêu cho ${targetPages.length} trang Target chứa ID thiếu...`);
      // Khởi chạy bot cào mục tiêu (missingOnly) trong background
      runCrawl({ missingOnly: true, targetPages }).catch(err => logSystem(`❌ Lỗi cào mục tiêu: ${err.message}`));

      res.json({
        success: true,
        message: `🚀 Đã Sync ${missingCount.toLocaleString('vi-VN')} ID thiếu và KÍCH HOẠT BOT CÀO MỤC TIÊU trong background!`,
        missingCount,
        targetPagesCount: targetPages.length,
      });
    } catch (err) {
      logSystem(`❌ Lỗi API cào mục tiêu: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API Nạp file dữ liệu JSON từ giao diện web để đối soát trực tiếp
  app.post('/api/compare-upload', async (req, res) => {
    try {
      let idsData = [];
      if (req.body && Array.isArray(req.body.items)) {
        idsData = req.body.items;
      } else if (req.body && Array.isArray(req.body.ids)) {
        idsData = req.body.ids;
      } else if (Array.isArray(req.body)) {
        idsData = req.body;
      }

      if (idsData.length === 0) {
        return res.status(400).json({ success: false, message: 'Dữ liệu nạp vào không hợp lệ hoặc rỗng!' });
      }

      const tempPath = path.join(__dirname, '../external_ids_uploaded.json');
      fs.writeFileSync(tempPath, JSON.stringify(idsData, null, 2), 'utf-8');
      logSystem(`📂 Đã nạp file JSON từ web với ${idsData.length.toLocaleString('vi-VN')} bản ghi. Đang tiến hành đối soát...`);

      // Chạy lại đối soát với file vừa nạp
      runComparison({ file: tempPath }).catch(err => logSystem(`❌ Lỗi đối soát file upload: ${err.message}`));

      res.json({ success: true, message: `Đã nạp thành công ${idsData.length.toLocaleString('vi-VN')} bản ghi và KÍCH HOẠT ĐỐI SOÁT trong background!` });
    } catch (err) {
      logSystem(`❌ Lỗi upload đối soát: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  });


  const PORT = config.apiPort || 4400;
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║   🌐 WEB BÁO CÁO KIỂM SOÁT & ĐỐI SOÁT 589.476 IDs        ║`);
    console.log(`║   • Trang chính:  http://localhost:${PORT}                  ║`);
    console.log(`║   • Trang Compare: http://localhost:${PORT}/compare          ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
  });
}

main().catch(console.error);
