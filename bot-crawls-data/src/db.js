const mongoose = require('mongoose');
const config = require('./config');

let isConnected = false;
let reconnectTimer = null;
const maxPoolSize = parseInt(process.env.MONGO_MAX_POOL_SIZE || '30', 10);
const minPoolSize = parseInt(process.env.MONGO_MIN_POOL_SIZE || '5', 10);

/**
 * Kết nối MongoDB với cấu hình tối ưu cho production:
 * - Connection pooling giới hạn (tránh quá nhiều connection → OOM)
 * - Auto-reconnect khi mất kết nối
 * - Timeout hợp lý để không treo vô hạn
 */
async function connectDB(attempt = 1) {
  if (isConnected) return;

  try {
    await mongoose.connect(config.mongo.uri, {
      // Connection pool: giới hạn số connection song song
      maxPoolSize,
      minPoolSize,

      // Timeout settings
      // 30s để tunnel kịp switch port (WARP block port 22 → tunnel thử port 443 mất ~15s)
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 300000,          // 5 minutes socket idle timeout
      connectTimeoutMS: 15000,          // 15s connection timeout

      // Heartbeat: kiểm tra server còn sống
      heartbeatFrequencyMS: 10000,      // Ping server mỗi 10s

      // Write concern: ghi xong mới trả kết quả (an toàn dữ liệu)
      w: 1,

      // Fix 1.1.1.1 / WARP connection issue by forcing IPv4
      family: 4,

      // Auto-index: tắt ở production để giảm tải startup
      autoIndex: process.env.NODE_ENV !== 'production',
    });

    isConnected = true;
    console.log(`✅ MongoDB connected: ${config.mongo.uri} (pool: ${minPoolSize}-${maxPoolSize})`);
  } catch (err) {
    console.error(`❌ MongoDB connection error (attempt ${attempt}): ${err.message}`);
    // Không exit ngay - tunnel SSH cần thời gian khởi động/switch port khi dùng WARP/1.1.1.1
    const delay = Math.min(5000 * attempt, 30000); // 5s, 10s, 15s... tối đa 30s
    console.log(`🔄 Retry in ${delay / 1000}s...`);
    await new Promise((r) => setTimeout(r, delay));
    return connectDB(attempt + 1);
  }
}

// ──────────────────────────────────
// Auto-reconnect handlers
// ──────────────────────────────────

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️ MongoDB disconnected');
  scheduleReconnect();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
  isConnected = false;
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  console.log('🔄 MongoDB reconnected');
});

function scheduleReconnect() {
  if (reconnectTimer) return; // Đang đợi reconnect rồi

  // Đợi 5s để tunnel SSH kịp reconnect/switch port (WARP scenario)
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (isConnected) return;

    console.log('🔄 Đang thử kết nối lại MongoDB...');
    try {
      await mongoose.connect(config.mongo.uri, {
      maxPoolSize,
      minPoolSize,
        serverSelectionTimeoutMS: 30000, // 30s để tunnel kịp switch port
        socketTimeoutMS: 300000,
        connectTimeoutMS: 15000,
        family: 4, // Fix 1.1.1.1 / WARP
      });
      isConnected = true;
      console.log('✅ MongoDB đã kết nối lại thành công');
    } catch (err) {
      console.error('❌ Reconnect thất bại:', err.message);
      scheduleReconnect(); // Thử lại
    }
  }, 5000); // Đợi 5s trước khi thử lại
}

// ──────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────

async function closeDB() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log('🔒 MongoDB connection closed');
  } catch (err) {
    console.error('Error closing MongoDB:', err.message);
  }
}

module.exports = { connectDB, closeDB };
