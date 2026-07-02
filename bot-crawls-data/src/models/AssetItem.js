const mongoose = require('mongoose');

/**
 * Bảng lưu thông tin chi tiết của từng phần tài sản (mỗi thông báo có thể gồm nhiều tài sản con)
 */
const assetItemSchema = new mongoose.Schema({
  noticeId: { type: mongoose.Schema.Types.ObjectId, index: true },
  sourceType: { type: String, enum: ['auction', 'org'], default: 'auction', index: true },
  sourceId: { type: Number, index: true },
  itemIndex: { type: Number, default: 0 }, // Vị trí trong danh sách tài sản con của thông báo (0, 1, 2...)

  name: { type: String, required: true, index: true },
  assetType: {
    type: String,
    enum: ['land', 'house', 'car', 'machinery', 'enforcement', 'public', 'other'],
    default: 'other',
    index: true,
  },
  rawText: String,
  normalizedText: String,

  coreIdentity: { type: String, index: true },       // Phần mô tả cốt lõi (đất đai, xe cộ,...) đã làm sạch
  locationIdentity: { type: String, index: true },   // Phần địa chỉ chuẩn hóa đã tách biệt

  identifiers: {
    plotNumber: { type: String, index: true },
    mapSheet: { type: String, index: true },
    certificateNumber: { type: String, index: true },
    licensePlate: { type: String, index: true },
    chassisNumber: { type: String, index: true },
    engineNumber: { type: String, index: true },
    apartmentNumber: { type: String, index: true },
    houseNumber: { type: String, index: true },
    contractNumber: { type: String, index: true },
    taxCode: { type: String, index: true }
  },

  area: Number,
  quantity: Number,
  startingPrice: Number,
  ownerName: { type: String, index: true },
  auctionOrg: { type: String, index: true },
  province: { type: String, index: true },
  district: { type: String, index: true },
  ward: { type: String, index: true },

  attachmentTextUsed: { type: Boolean, default: false },
  blockingKeys: [{ type: String, index: true }], // Các khóa blocking để tối ưu candidate generation
}, {
  timestamps: true,
});

// Compound indexes cho tìm kiếm nhanh
assetItemSchema.index({ province: 1, district: 1, ward: 1 });
assetItemSchema.index({ "identifiers.plotNumber": 1, "identifiers.mapSheet": 1 });
assetItemSchema.index({ sourceType: 1, sourceId: 1, itemIndex: 1 }, { unique: true });

module.exports = mongoose.model('AssetItem', assetItemSchema);
