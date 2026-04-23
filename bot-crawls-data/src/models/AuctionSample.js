const mongoose = require('mongoose');

const auctionSampleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Tên tài sản đấu giá
}, {
  timestamps: true,
});

module.exports = mongoose.model('AuctionSample', auctionSampleSchema);
