const mongoose = require('mongoose');

/**
 * Schema lưu thông báo lựa chọn tổ chức đấu giá
 */
const orgSelectionSchema = new mongoose.Schema({
  sourceId: { type: Number, required: true, unique: true, index: true },
  titleName: String,
  slug: String,

  name: { type: String, index: true },
  shortDescription: String,

  // Parties
  owner: String,
  ownerAddress: String,

  // Dates
  publishedAt: Date,
  receiveTimeStart: Date,
  receiveTimeEnd: Date,
  lastUpdated: Date,

  // Property info
  propertyTypeId: Number,
  propertyTypeName: String,
  address: String,

  // Meta
  sourceUrl: String,
  province: { type: String, index: true },

  // Detail scraped info
  assetDescription: String,
  startingPrice: Number,
  requirements: String,

  // Attached files
  files: [{
    name: String,
    url: String
  }],

  // Multi-asset
  properties: [{
    name: String,
    amount: String,
    startPrice: Number,
    deposit: Number,
    place: String,
    quality: String,
  }],

  // Publish round info
  publishRound: { type: Number, default: 1 },
  publishRoundLabel: String,
  rootId: Number,
  relatedIds: [Number],

  // Crawl tracking
  detailScraped: { type: Boolean, default: false },
  lastCrawledAt: Date,
}, {
  timestamps: true,
});

orgSelectionSchema.index({ name: 'text', shortDescription: 'text' });
orgSelectionSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('OrgSelection', orgSelectionSchema);
