const mongoose = require('mongoose');
const OrgSelection = require('./src/models/OrgSelection');
const Duplicate = require('./src/models/Duplicate');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  const res = await OrgSelection.updateMany({}, { $set: { detailScraped: false } });
  console.log('Reset detailScraped for OrgSelection:', res);
  // Also clear old org duplicates so they are recreated cleanly
  const res2 = await Duplicate.deleteMany({ type: 'org' });
  console.log('Cleared old org duplicates:', res2);
  mongoose.disconnect();
}
run();
