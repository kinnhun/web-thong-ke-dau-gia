const mongoose = require('mongoose');

const rawAuctionIdSchema = new mongoose.Schema({
  sourceId: { type: Number, required: true, unique: true, index: true },
  pageNumber: { type: Number, required: true, index: true },
  crawledAt: { type: Date, default: Date.now },
}, {
  timestamps: false,
});

rawAuctionIdSchema.index({ pageNumber: 1, sourceId: 1 });

module.exports = mongoose.model('RawAuctionId', rawAuctionIdSchema, 'raw_auction_ids');
