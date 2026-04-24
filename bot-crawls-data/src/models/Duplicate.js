const mongoose = require('mongoose');

/**
 * Bảng lưu các nhóm bài đăng lại (cùng tài sản, khác sourceId).
 * 
 * Logic phát hiện đăng lại:
 *   1. API pageAuctionInfoPublish2 trả về rootID + relatedIds
 *   2. Search API với cùng tên tài sản (nameAsset exact match)
 *   3. Aggregate DB theo tên giống nhau
 * 
 * Mỗi document = 1 nhóm tài sản → chứa tất cả các lần đăng
 */

const relistEntrySchema = new mongoose.Schema({
  sourceId: { type: Number, required: true },
  price: Number,               // Giá khởi điểm lần đăng này
  publishedAt: Date,            // Ngày đăng
  publishRound: Number,         // Lần đăng thứ mấy (từ API)
  publishRoundLabel: String,    // "Thông báo công khai lần 2"
  rootId: Number,               // rootID từ API (nếu có)
  sourceUrl: String,            // Link bài đăng
}, { _id: false });

const duplicateSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  sourceIds: [Number],
  type: { type: String, enum: ['auction', 'org'], default: 'auction' },

  // Chi tiết từng lần đăng (sắp xếp theo thời gian)
  entries: [relistEntrySchema],

  // Tóm tắt giá
  firstPrice: Number,            // Giá lần đăng đầu tiên
  latestPrice: Number,           // Giá lần đăng gần nhất
  priceDropPercent: Number,      // % giảm giá (so với lần đầu)
  isPriceDrop: { type: Boolean, default: false },  // Có giảm giá không?
  relistCount: { type: Number, default: 1 },       // Số lần đăng

  // Root ID gốc (từ API pageAuctionInfoPublish2)
  rootId: Number,
}, {
  timestamps: true,
});

// Compound index cho tìm kiếm nhanh
duplicateSchema.index({ type: 1, isPriceDrop: -1, updatedAt: -1 });
duplicateSchema.index({ 'sourceIds': 1 });

module.exports = mongoose.model('Duplicate', duplicateSchema);
