const mongoose = require('mongoose');
const config = require('./config');

let isConnected = false;
let reconnectTimer = null;

/**
 * Kết nối MongoDB với cấu hình tối ưu cho production:
 * - Connection pooling giới hạn (tránh quá nhiều connection → OOM)
 * - Auto-reconnect khi mất kết nối
 * - Timeout hợp lý để không treo vô hạn
 */
async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(config.mongo.uri, {
      // Connection pool: giới hạn số connection song song
      maxPoolSize: 10,         // Tối đa 10 connection (default 100 → quá nhiều cho VPS nhỏ)
      minPoolSize: 2,          // Giữ ít nhất 2 connection sẵn sàng
      
      // Timeout settings
      serverSelectionTimeoutMS: 10000,  // 10s timeout khi chọn server
      socketTimeoutMS: 300000,          // 5 minutes socket idle timeout
      connectTimeoutMS: 10000,          // 10s connection timeout
      
      // Heartbeat: kiểm tra server còn sống
      heartbeatFrequencyMS: 10000,      // Ping server mỗi 10s
      
      // Write concern: ghi xong mới trả kết quả (an toàn dữ liệu)
      w: 1,
      
      // Auto-index: tắt ở production để giảm tải startup
      autoIndex: true,
    });

    isConnected = true;
    console.log(`✅ MongoDB connected: ${config.mongo.uri} (pool: 2-10)`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
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
  
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (isConnected) return;
    
    console.log('🔄 Đang thử kết nối lại MongoDB...');
    try {
      await mongoose.connect(config.mongo.uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 300000,
        connectTimeoutMS: 10000,
      });
      isConnected = true;
      console.log('✅ MongoDB đã kết nối lại thành công');
    } catch (err) {
      console.error('❌ Reconnect thất bại:', err.message);
      scheduleReconnect(); // Thử lại sau 10s
    }
  }, 10000); // Đợi 10s trước khi thử lại
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
