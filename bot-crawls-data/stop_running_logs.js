const mongoose = require('mongoose');
const CrawlLog = require('./src/models/CrawlLog');

(async () => {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  const docs = await CrawlLog.find({
    status: 'running',
    type: { $in: ['recrawl_missing_properties', 'duplicate_scan'] },
  });

  for (const doc of docs) {
    doc.status = 'failed';
    doc.finishedAt = new Date();
    doc.errorMessages = [
      ...(Array.isArray(doc.errorMessages) ? doc.errorMessages : []),
      'Đã được dừng thủ công để restart hệ thống.',
    ].slice(-10);
    await doc.save();
  }

  console.log(JSON.stringify(docs.map((d) => ({ id: String(d._id), type: d.type })), null, 2));
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
