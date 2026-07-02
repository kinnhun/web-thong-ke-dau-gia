const mongoose = require('mongoose');

/**
 * Bảng lưu các cặp AssetItem nghi ngờ trùng lặp (độ tương đồng trung bình từ 65 - 85 điểm) cần quản trị viên duyệt thủ công.
 */
const potentialDuplicateSchema = new mongoose.Schema({
  assetItemIdA: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetItem', required: true, index: true },
  assetItemIdB: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetItem', required: true, index: true },
  
  score: { type: Number, required: true, index: true },
  reasons: [String],
  conflicts: [String],
  
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending',
    index: true
  },
  reviewedBy: String,
  reviewedAt: Date
}, {
  timestamps: true,
});

potentialDuplicateSchema.index({ status: 1, score: -1 });

module.exports = mongoose.model('PotentialDuplicate', potentialDuplicateSchema);
