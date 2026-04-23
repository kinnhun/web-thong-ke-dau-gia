const mongoose = require('mongoose');
const config = require('./config');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(config.mongo.uri);
    isConnected = true;
    console.log(`✅ MongoDB connected: ${config.mongo.uri}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️ MongoDB disconnected');
});

module.exports = { connectDB };
