const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia').then(async () => {
  const AuctionNotice = require('./src/models/AuctionNotice');
  const name = 'Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 490 Gia Phú, Phường 3, Quận 6 (nay là phường Bình Tiên), Thành phố Hồ Chí Minh';
  const res = await AuctionNotice.find({ $text: { $search: name } }, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(10).select('sourceId name').lean();
  console.log('Text Search results:', res.length, res);
  
  // also check regex search
  const regexRes = await AuctionNotice.find({ name: { $regex: '490 Gia Ph', $options: 'i' } }).select('sourceId name').lean();
  console.log('Regex Search results:', regexRes.length, regexRes);
  mongoose.disconnect();
}).catch(console.error);
