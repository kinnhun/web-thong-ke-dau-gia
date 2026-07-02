const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  console.log('--- Checking Duplicates with Size >= 2 ---');
  const size2OrMore = await Duplicate.countDocuments({
    type: 'auction',
    'sourceIds.1': { $exists: true }
  });
  console.log('Duplicates with size >= 2:', size2OrMore);

  const size3OrMore = await Duplicate.countDocuments({
    type: 'auction',
    'sourceIds.2': { $exists: true }
  });
  console.log('Duplicates with size >= 3:', size3OrMore);

  const size1 = await Duplicate.countDocuments({
    type: 'auction',
    'sourceIds.1': { $exists: false }
  });
  console.log('Duplicates with size == 1:', size1);

  // Check how many AuctionNotices have duplicateId or rootId
  const noticesWithRoot = await AuctionNotice.countDocuments({ rootId: { $ne: null } });
  console.log('AuctionNotices with rootId:', noticesWithRoot);

  const noticesWithDuplicateId = await AuctionNotice.countDocuments({ duplicateId: { $ne: null } });
  console.log('AuctionNotices with duplicateId:', noticesWithDuplicateId);

  // Check the number of duplicates for the organizer "Công ty đấu giá hợp danh Đông Nam"
  const dongNamDupsSize2 = await Duplicate.countDocuments({
    organizer: 'Công ty đấu giá hợp danh Đông Nam',
    'sourceIds.1': { $exists: true }
  });
  console.log('Dong Nam duplicates with size >= 2:', dongNamDupsSize2);

  const dongNamAuctions = await AuctionNotice.countDocuments({
    organizer: 'Công ty đấu giá hợp danh Đông Nam'
  });
  console.log('Dong Nam total auctions:', dongNamAuctions);

  // Check if there is any organizer with exactly 33,915 auctions or something similar
  const allOrgs = await AuctionNotice.aggregate([
    { $group: { _id: '$organizer', count: { $sum: 1 } } }
  ]);
  const matchedOrg = allOrgs.find(o => Math.abs(o.count - 33915) < 500);
  if (matchedOrg) {
    console.log('Matched Organizer by count:', matchedOrg);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
