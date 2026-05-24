const mongoose = require('mongoose');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

async function test() {
  mongoose.set('debug', true);
  console.log('Connecting...');
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', {
    autoIndex: false
  });
  console.log('Connected!');
  
  console.log('Running deleteMany...');
  await AuctionNotice.deleteMany({});
  console.log('Delete done!');
  
  await mongoose.disconnect();
  console.log('Disconnected!');
}

test().catch(console.error);
