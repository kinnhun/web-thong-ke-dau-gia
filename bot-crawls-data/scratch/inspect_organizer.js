const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const Duplicate = require('../src/models/Duplicate');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  // Find organizer matches
  const organizerQuery = { $regex: 'Trung tâm dịch vụ bán đấu giá tài sản TPHCM', $options: 'i' };
  const count = await AuctionNotice.countDocuments({ organizer: organizerQuery });
  console.log(`Total notices by organizer: ${count}`);

  // Fetch some notices to see how they are grouped
  const notices = await AuctionNotice.find({ organizer: organizerQuery }).lean();
  
  // Find all duplicates containing these notices
  const sourceIds = notices.map(n => n.sourceId);
  const duplicates = await Duplicate.find({ sourceIds: { $in: sourceIds } }).lean();
  console.log(`Total duplicate groups containing these notices: ${duplicates.length}`);

  // For each duplicate group, inspect if there is any mismatch
  let mismatchedCount = 0;
  for (const dup of duplicates) {
    const groupNotices = await AuctionNotice.find({ sourceId: { $in: dup.sourceIds } }).lean();
    
    // Check if names in group have different keywords
    // For example, if one has "xe" and another has "quyền sử dụng đất" or "khoản nợ"
    const hasVehicle = groupNotices.some(n => /xe\s+o\s+to|xe\s+may/i.test(n.name));
    const hasLand = groupNotices.some(n => /quyen\s+su\s+dung\s+dat|nha\s+o|can\s+ho/i.test(n.name));
    const hasDebt = groupNotices.some(n => /khoan\s+no/i.test(n.name));
    const hasWood = groupNotices.some(n => /go\s+trac|cay\s+go/i.test(n.name));

    let categoriesCount = 0;
    if (hasVehicle) categoriesCount++;
    if (hasLand) categoriesCount++;
    if (hasDebt) categoriesCount++;
    if (hasWood) categoriesCount++;

    if (categoriesCount > 1 || dup.sourceIds.length > 30) {
      mismatchedCount++;
      console.log(`\n--- SUSPICIOUS GROUP: ${dup.name} (Size: ${dup.sourceIds.length}) ---`);
      console.log(`Group ID: ${dup._id}`);
      for (const n of groupNotices) {
        console.log(`  - [${n.sourceId}] ${n.name} (${n.initialPrice} VND)`);
      }
    }
  }

  console.log(`\nTotal suspicious groups: ${mismatchedCount}`);
  await mongoose.connection.close();
}

run().catch(console.error);
