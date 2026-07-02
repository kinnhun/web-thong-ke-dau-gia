const mongoose = require('mongoose');

/**
 * Bảng lưu nhóm các AssetItem được xác định là cùng 1 tài sản thực (đăng lại nhiều lần)
 */
const relistAssetEntrySchema = new mongoose.Schema({
  assetItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetItem', required: true },
  sourceId: { type: Number, required: true },
  price: Number,               // Giá khởi điểm lần đăng này
  publishedAt: Date,            // Ngày đăng
  publishRound: Number,         // Lần đăng thứ mấy
  publishRoundLabel: String,    // Ví dụ: "Thông báo công khai lần 2"
  sourceUrl: String,            // Link bài đăng
}, { _id: false });

const assetGroupSchema = new mongoose.Schema({
  assetItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AssetItem', index: true }],
  sourceIds: [{ type: Number, index: true }], // Cached để query nhanh

  canonicalTitle: String,
  canonicalLocation: String,
  canonicalOwner: String,

  firstPrice: Number,
  latestPrice: Number,
  relistCount: { type: Number, default: 1 },
  priceDropPercent: { type: Number, default: 0 },
  isPriceDrop: { type: Boolean, default: false, index: true },
  lastPublishedAt: { type: Date, index: true },

  confidence: Number, // Độ tin cậy (0 - 100)
  matchReasons: [String],
  reviewStatus: {
    type: String,
    enum: ['auto', 'pending', 'confirmed', 'rejected'],
    default: 'auto',
    index: true
  }
}, {
  timestamps: true,
});

assetGroupSchema.index({ lastPublishedAt: -1 });
assetGroupSchema.index({ relistCount: -1, lastPublishedAt: -1 });
assetGroupSchema.index({ isPriceDrop: 1, priceDropPercent: -1 });

module.exports = mongoose.model('AssetGroup', assetGroupSchema);
