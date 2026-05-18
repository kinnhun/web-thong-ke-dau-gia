const mongoose = require('mongoose');

// Kết nối DB (Cần thay đổi URI nếu có biến môi trường)
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dau-gia';
mongoose.connect(uri)
  .then(async () => {
    // import schema/models
    require('../bot-crawls-data/src/models/AuctionNotice');
    const AuctionNotice = mongoose.model('AuctionNotice');
    
    const items = await AuctionNotice.find({ sourceId: { $in: [310238, 382830, 564179] } })
      .select('sourceId name province')
      .lean();
      
    console.log('Items in DB:');
    items.forEach(item => {
      console.log(`- ID: ${item.sourceId}, Province: ${item.province}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Lỗi kết nối DB:', err);
    process.exit(1);
  });
