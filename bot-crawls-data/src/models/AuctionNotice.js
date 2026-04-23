const mongoose = require('mongoose');

/**
 * Schema lưu thông báo đấu giá (Thông báo công khai việc đấu giá)
 * Map với Auction interface trong mockAuctions.ts
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
  name: { type: String, index: true },             // propertyName
  shortDescription: String,                         // subPropertyName
  type: {                                           // AssetType
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
  isDuplicateSuspect: { type: Boolean, default: false },

  // Attached files
  files: [{
    name: String,
    url: String
  }],

  // Sample ID to group identical names
  sampleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuctionSample', index: true },

  // Crawl tracking
  detailScraped: { type: Boolean, default: false },
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

module.exports = mongoose.model('AuctionNotice', auctionNoticeSchema);
