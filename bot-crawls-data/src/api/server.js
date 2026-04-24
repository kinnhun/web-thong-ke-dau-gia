const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('../config');
const { connectDB } = require('../db');
const auctionRoutes = require('./routes');
const dashboardRoutes = require('./dashboard.routes');
const discountedRoutes = require('./discounted.routes');
const relistedRoutes = require('./relisted.routes');
const reportsRoutes = require('./reports.routes');

/**
 * Tạo Express app (không listen)
 */
function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Phục vụ giao diện web tĩnh từ thư mục public
  app.use(express.static(path.join(__dirname, '../../public')));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', auctionRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/discounted', discountedRoutes);
  app.use('/api/relisted', relistedRoutes);
  app.use('/api/reports', reportsRoutes);

  // Error handler
  app.use((err, req, res, _next) => {
    console.error('API Error:', err.message);
    res.status(err.statusCode || 500).json({
      error: true,
      message: err.message || 'Internal server error',
    });
  });

  return app;
}

/**
 * Start standalone API server
 */
async function startServer() {
  await connectDB();
  const app = createServer();
  const port = config.api.port;
  app.listen(port, () => {
    console.log(`\n🌐 API server chạy tại http://localhost:${port}`);
  });
  return app;
}

// Run directly
if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = { createServer, startServer };
