const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AssetItem = require('../src/models/AssetItem');
const AuctionNotice = require('../src/models/AuctionNotice');

async function run() {
  await connectDB();

  // Find all distinct organizers that match "Trung tâm Dịch vụ bán đấu giá tài sản" or similar in TPHCM
  const orgs = await AuctionNotice.distinct('organizer', {
    organizer: /Trung tâm Dịch vụ đấu giá tài sản Thành phố Hồ Chí Minh|Trung tâm Dịch vụ bán đấu giá tài sản/i
  });
  console.log('Matching organizers in DB:', orgs);

  for (const org of orgs) {
    const count = await AuctionNotice.countDocuments({ organizer: org });
    const itemFields = await AssetItem.countDocuments({ auctionOrg: org });
    console.log(`Organizer: "${org}" - Notices: ${count}, AssetItems: ${itemFields}`);
  }

  await closeDB();
}

run().catch(console.error);
