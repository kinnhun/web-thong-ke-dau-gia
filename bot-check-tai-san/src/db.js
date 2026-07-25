const mongoose = require('mongoose');
const config = require('./config');

let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection && mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(config.mongo.uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 300000,
      connectTimeoutMS: 15000,
      family: 4,
    });
    isConnected = true;
    console.log(`✅ MongoDB connected: ${config.mongo.uri}`);
  } catch (err) {
    console.error(`❌ MongoDB connection error: ${err.message}`);
    await new Promise((r) => setTimeout(r, 5000));
    return connectDB();
  }
}

async function closeDB(options = {}) {
  const { force = false } = typeof options === 'object' && options !== null ? options : {};
  if (!force && require.main !== module) {
    // Không đóng DB khi đang chạy như một module trong Express web server
    return;
  }
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    console.log('🔒 MongoDB connection closed');
  }
}

module.exports = { connectDB, closeDB };

