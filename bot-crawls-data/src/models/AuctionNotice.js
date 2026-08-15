const mongoose = require('mongoose');

/**
 * Schema lưu thông báo đấu giá (Thông báo công khai việc đấu giá)
 */
const priceHistorySchema = new mongoose.Schema({
  round: Number,
  publishedAt: Date,
  startingPrice: Number,
  deposit: Number,
  organizer: String,
  owner: String,
  sourceUrl: String,
}, { _id: false });

const auctionNoticeSchema = new mongoose.Schema({
  // Source identification
  sourceId: { type: Number, required: true, unique: true, index: true },
  titleName: String,
  slug: String,

  // Map với Auction interface
  name: { type: String, index: true },
  shortDescription: String,
  type: {
    type: String,
    enum: ['land', 'house', 'car', 'machinery', 'enforcement', 'public', 'other'],
    default: 'other',
    index: true,
  },
  province: { type: String, index: true },
  district: String,
  address: String,

  // Prices
  initialPrice: Number,
  currentPrice: Number,
  deposit: Number,
  depositPercent: String,
  applicationFee: Number,
  stepPrice: String,

  // Rounds & history
  rounds: { type: Number, default: 1 },
  history: [priceHistorySchema],

  // Dates
  publishedAt: { type: Date, index: true },
  auctionDate: Date,
  auctionDateEnd: Date,
  registrationStart: Date,
  registrationEnd: Date,

  // Parties
  organizer: { type: String, index: true },
  owner: { type: String, index: true },

  // Meta
  sourceUrl: String,
  quality: String,
  propertyTypeId: Number,
  propertyTypeName: String,
  propertyAmount: String,
  conditions: String,
  viewingInfo: String,

  // Status
  status: {
    type: String,
    enum: ['upcoming', 'receiving_docs', 'newly_reduced', 'watch', 'completed', 'unknown'],
    default: 'unknown',
    index: true,
  },

  // Attached files
  files: [{
    name: String,
    url: String
  }],

  // Multi-asset: 1 bài đăng có nhiều tài sản với giá khác nhau
  properties: [{
    name: String,            // Tên tài sản (vd: "Căn tin", "Nhà giữ xe")
    amount: String,          // Số lượng
    startPrice: Number,      // Giá khởi điểm
    deposit: Number,         // Tiền đặt trước (số tiền tuyệt đối)
    depositPercent: String,  // Tỷ lệ % tiền đặt trước (nếu có)
    place: String,           // Nơi có tài sản
    quality: String,         // Chất lượng / mô tả
  }],

  // Publish round info (từ API pageAuctionInfoPublish2)
  publishRound: { type: Number, default: 1 },    // Đăng lần thứ mấy
  publishRoundLabel: String,                       // "Thông báo công khai lần 1"
  rootId: Number,                                  // ID gốc (rootID từ API)
  relatedIds: [Number],                            // Tất cả IDs liên quan (các lần đăng)

  // Multi-asset & Batch flags
  isBatchNotice: { type: Boolean, default: false, index: true },

  // Crawl tracking
  detailScraped: { type: Boolean, default: false },
  zeroPriceRetryCount: { type: Number, default: 0 },
  lastCrawledAt: Date,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Text index for search
auctionNoticeSchema.index({ name: 'text', shortDescription: 'text', address: 'text' });

// Compound indexes for common queries
auctionNoticeSchema.index({ type: 1, province: 1 });
auctionNoticeSchema.index({ publishedAt: -1 });
auctionNoticeSchema.index({ auctionDate: -1 });

// ★ Indexes cho mega crawl queries (detailScraped filter)
auctionNoticeSchema.index({ detailScraped: 1, publishedAt: -1 });
auctionNoticeSchema.index({ lastCrawledAt: 1, publishedAt: -1 });

// ★ Index cho price range filter
auctionNoticeSchema.index({ currentPrice: 1 });

module.exports = mongoose.model('AuctionNotice', auctionNoticeSchema);
