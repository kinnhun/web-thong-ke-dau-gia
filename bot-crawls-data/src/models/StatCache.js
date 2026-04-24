const mongoose = require('mongoose');

const statCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed },
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StatCache', statCacheSchema);
