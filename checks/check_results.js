const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  console.log('--- Inspecting new Duplicate groups ---');

  // Find duplicates containing "06 xe mô tô" in their name
  const dups = await Duplicate.find({
    type: 'auction',
    $or: [
      { name: /06 xe mô tô/i },
      { name: /06 xe ô tô/i },
      { name: /06 xe nâng/i }
    ]
  }).lean();

  console.log(`Found ${dups.length} groups matching search query.`);
  for (const d of dups) {
    console.log(`\nGroup ID: ${d._id}`);
    console.log(`Group Name: "${d.name}"`);
    console.log(`Size: ${d.sourceIds?.length || 0} sourceIds`);
    console.log(`Source IDs: ${JSON.stringify(d.sourceIds)}`);
    console.log(`Relist Count: ${d.relistCount}`);

    // Inspect the names of items in this group
    const notices = await AuctionNotice.find({ sourceId: { $in: d.sourceIds } }).select('sourceId name licensePlate').lean();
    console.log('Items in this group:');
    notices.forEach(n => {
      console.log(`  - [ID: ${n.sourceId}] ${n.name}`);
    });
  }

  // Check if there are any extremely large groups remaining under this organizer
  const largeDups = await Duplicate.find({
    type: 'auction',
    organizer: "Trung tâm dịch vụ bán đấu giá tài sản TPHCM",
    'sourceIds.10': { $exists: true } // Size > 10
  }).sort({ 'sourceIds.length': -1 }).lean();

  console.log(`\nFound ${largeDups.length} groups with size > 10.`);
  largeDups.slice(0, 5).forEach(d => {
    console.log(`  - [ID: ${d._id}] ${d.name} (${d.sourceIds.length} items)`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);
