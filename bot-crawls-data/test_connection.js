const mongoose = require('mongoose');

const uri = 'mongodb://127.0.0.1:27017/thong_ke_dau_gia';

async function test() {
  console.log('Connecting to:', uri);
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ MongoDB connected successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.log('\nTips:');
    console.log('1. Make sure MongoDB Service is running.');
    console.log('2. Try running: Start-Service -Name MongoDB (as Administrator)');
    console.log('3. Or run mongod.exe manually.');
    process.exit(1);
  }
}

test();
