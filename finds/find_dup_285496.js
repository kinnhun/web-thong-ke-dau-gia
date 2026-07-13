const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const dup = await Duplicate.findOne({ sourceIds: 285496 }).lean();
    console.log('Duplicate Doc containing 285496:', dup);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
