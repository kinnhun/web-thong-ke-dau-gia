const mongoose = require('mongoose');

/**
 * Schema lưu thông báo lựa chọn tổ chức đấu giá
 */
const orgSelectionSchema = new mongoose.Schema({
  sourceId: { type: Number, required: true, unique: true, index: true },
  titleName: String,
  slug: String,

  name: { type: String, index: true },             // propertyName
  shortDescription: String,                         // subPropertyName

  // Parties
  owner: String,                                    // fullname
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

  // Sample ID to group identical names
  sampleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuctionSample', index: true },

  // Crawl tracking
  detailScraped: { type: Boolean, default: false },
  lastCrawledAt: Date,
}, {
  timestamps: true,
});

orgSelectionSchema.index({ name: 'text', shortDescription: 'text' });
orgSelectionSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('OrgSelection', orgSelectionSchema);
