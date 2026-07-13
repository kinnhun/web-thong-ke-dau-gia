const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const config = require('../src/config');

async function check() {
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB.');
  
  // Total notices
  const total = await AuctionNotice.countDocuments({});
  console.log('Total AuctionNotices in DB:', total);

  // Distinct organizers containing "TPHCM"
  const tphcmOrgs = await AuctionNotice.distinct('organizer', { organizer: /TPHCM/i });
  console.log('Distinct organizers with TPHCM:', tphcmOrgs);

  // Test "Trung tâm TPHCM" filter
  const countWithFilter = await AuctionNotice.countDocuments({ organizer: /Trung tâm TPHCM/i });
  console.log('Count with /Trung tâm TPHCM/i:', countWithFilter);

  // Let's search with /Trung tâm.*TPHCM/i or similar
  const countWithFuzzyFilter = await AuctionNotice.countDocuments({ organizer: /Trung tâm.*TPHCM/i });
  console.log('Count with /Trung tâm.*TPHCM/i:', countWithFuzzyFilter);

  await mongoose.disconnect();
}

check().catch(console.error);
