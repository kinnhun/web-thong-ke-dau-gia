const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { connectDB } = require('./db');
const { getAuditStats, getPaginatedIDs } = require('./reporter');
const { runCrawl } = require('./crawler');

async function main() {
  await connectDB();

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Phục vụ giao diện tĩnh public/report.html
  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/report.html'));
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

  // API đọc log chi tiết từng lần gọi API
  app.get('/api/logs', (req, res) => {
    try {
      const fs = require('fs');
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
    runCrawl().catch(console.error);
    res.json({ success: true, message: 'Đã kích hoạt bot cào dữ liệu trong background!' });
  });

  app.post('/api/trigger-retry', (req, res) => {
    runCrawl({ retryOnly: true }).catch(console.error);
    res.json({ success: true, message: 'Đã kích hoạt cào lại các trang lỗi!' });
  });

  const PORT = config.apiPort || 4400;
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║   🌐 WEB BÁO CÁO KIỂM SOÁT 589.476 IDs                   ║`);
    console.log(`║   Đường dẫn: http://localhost:${PORT}                       ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
  });
}

main().catch(console.error);
