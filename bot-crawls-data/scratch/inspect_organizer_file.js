const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const Duplicate = require('../src/models/Duplicate');
const fs = require('fs');
const path = require('path');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const organizerQuery = { $regex: 'Trung tâm dịch vụ bán đấu giá tài sản TPHCM', $options: 'i' };
  const notices = await AuctionNotice.find({ organizer: organizerQuery }).lean();
  
  const sourceIds = notices.map(n => n.sourceId);
  const duplicates = await Duplicate.find({ sourceIds: { $in: sourceIds } }).lean();

  const outPath = path.join(__dirname, 'suspicious_groups.txt');
  const stream = fs.createWriteStream(outPath);

  stream.write(`Total notices by organizer: ${notices.length}\n`);
  stream.write(`Total duplicate groups containing these notices: ${duplicates.length}\n\n`);

  let mismatchedCount = 0;
  for (const dup of duplicates) {
    const groupNotices = await AuctionNotice.find({ sourceId: { $in: dup.sourceIds } }).lean();
    
    // Check if names in group have different keywords
    const hasVehicle = groupNotices.some(n => /xe\s+o\s+to|xe\s+may|o\s+to|moto/i.test(n.name));
    const hasLand = groupNotices.some(n => /quyen\s+su\s+dung\s+dat|nha\s+o|can\s+ho|dat\s+o|thua\s+dat/i.test(n.name));
    const hasDebt = groupNotices.some(n => /khoan\s+no|no\s+xau/i.test(n.name));
    const hasWood = groupNotices.some(n => /go\s+trac|cay\s+go|go\s+hop/i.test(n.name));

    let categoriesCount = 0;
    if (hasVehicle) categoriesCount++;
    if (hasLand) categoriesCount++;
    if (hasDebt) categoriesCount++;
    if (hasWood) categoriesCount++;

    if (categoriesCount > 1 || dup.sourceIds.length > 30) {
      mismatchedCount++;
      stream.write(`\n--- SUSPICIOUS GROUP: ${dup.name} (Size: ${dup.sourceIds.length}) ---\n`);
      stream.write(`Group ID: ${dup._id}\n`);
      for (const n of groupNotices) {
        stream.write(`  - [${n.sourceId}] ${n.name} (${n.initialPrice} VND)\n`);
      }
    }
  }

  stream.write(`\nTotal suspicious groups: ${mismatchedCount}\n`);
  stream.end();

  console.log(`Saved results to ${outPath}`);
  await mongoose.connection.close();
}

run().catch(console.error);
