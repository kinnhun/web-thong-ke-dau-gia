const mongoose = require('mongoose');

const crawlStateSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, default: 'full_id_crawl' },
  totalRecords: { type: Number, default: 589476 },
  totalPages: { type: Number, default: 5895 },
  completedCount: { type: Number, default: 0 },
  totalApiCalls: { type: Number, default: 0 },
  successfulApiCalls: { type: Number, default: 0 },
  failedApiCalls: { type: Number, default: 0 },
  pagesCompleted: [{ type: Number }],
  pagesFailed: [{
    pageNumber: Number,
    error: String,
    failedAt: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ['idle', 'running', 'completed', 'paused'], default: 'idle' },
  lastProcessedPage: { type: Number, default: 0 },
  startedAt: Date,
  finishedAt: Date,
}, {
  timestamps: true,
});

module.exports = mongoose.model('CrawlState', crawlStateSchema, 'crawl_states');
