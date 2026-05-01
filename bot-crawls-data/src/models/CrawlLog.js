const mongoose = require('mongoose');

/**
 * Theo dõi tiến trình crawl
 */
const crawlLogSchema = new mongoose.Schema({
  type: { type: String, enum: ['auction_notice', 'org_selection', 'detail', 'org_detail', 'duplicate_scan', 'recrawl_missing_properties', 'mega_detail_crawl', 'crawl_duplicate_details'], required: true },
  startedAt: { type: Date, default: Date.now },
  finishedAt: Date,
  status: { type: String, enum: ['running', 'completed', 'failed', 'early_stopped'], default: 'running' },
  totalPages: Number,
  pagesProcessed: Number,
  itemsInserted: Number,
  itemsUpdated: Number,
  itemsSkipped: Number,
  errorMessages: [String],
  lastPage: Number,
  recentNotices: [{ sourceId: Number, name: String, province: String, publishedAt: Date }],
}, {
  timestamps: true,
});

// ★ Index cho frequent query pattern: tìm running jobs theo type
crawlLogSchema.index({ type: 1, status: 1, createdAt: -1 });
crawlLogSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model('CrawlLog', crawlLogSchema);
