const mongoose = require('mongoose');

/**
 * Theo dõi tiến trình crawl
 */
const crawlLogSchema = new mongoose.Schema({
  type: { type: String, enum: ['auction_notice', 'org_selection', 'detail', 'org_detail'], required: true },
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
}, {
  timestamps: true,
});

module.exports = mongoose.model('CrawlLog', crawlLogSchema);
