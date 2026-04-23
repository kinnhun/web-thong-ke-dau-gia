const mongoose = require('mongoose');

/**
 * Bảng lưu các bài đăng trùng lặp (đăng lần 2 trở lên).
 * Chỉ lưu name + mảng sourceIds.
 */
const duplicateSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  sourceIds: [Number],
  type: { type: String, enum: ['auction', 'org'], default: 'auction' },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Duplicate', duplicateSchema);
