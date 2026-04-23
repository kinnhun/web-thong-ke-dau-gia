const mongoose = require('mongoose');

/**
 * Bảng gom nhóm các bài đấu giá có CÙNG TÊN tài sản.
 * 
 * Mục đích: Khi tài sản không bán được → giảm giá → đăng lại,
 * tên vẫn giống nhau nhưng sourceId khác nhau.
 * Bảng này gom tất cả sourceIds lại để theo dõi lịch sử giá.
 */
const sampleItemSchema = new mongoose.Schema({
  sourceId: { type: Number, required: true },
  price: Number,               // Giá khởi điểm lần đăng này
  publishedAt: Date,            // Ngày đăng
  sourceType: { type: String, enum: ['auction', 'org'] },
}, { _id: false });

const auctionSampleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  items: [sampleItemSchema],     // Danh sách các lần đăng (sắp xếp theo thời gian)
  count: { type: Number, default: 1 },
  province: String,
  firstPrice: Number,            // Giá lần đăng đầu tiên
  latestPrice: Number,           // Giá lần đăng gần nhất
  priceReduced: { type: Boolean, default: false }, // Đã giảm giá chưa?
}, {
  timestamps: true,
});

module.exports = mongoose.model('AuctionSample', auctionSampleSchema);
