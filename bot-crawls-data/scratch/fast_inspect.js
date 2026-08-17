const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const OrgSelection = require('../src/models/OrgSelection');

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('Connected to MongoDB!');

  const totalAuctions = await AuctionNotice.countDocuments();
  const totalOrgs = await OrgSelection.countDocuments();

  const missingAuctionDetail = await AuctionNotice.countDocuments({ detailScraped: { $ne: true } });

  console.log('\n=== STATS ===');
  console.log('Total Auctions:', totalAuctions);
  console.log('Total Orgs:', totalOrgs);
  console.log('Missing Auction Detail (detailScraped != true):', missingAuctionDetail);

  console.log('\n=== LATEST 10 AUCTION NOTICES IN DB ===');
  const latestAuctions = await AuctionNotice.find().sort({ createdAt: -1 }).limit(10).lean();
  latestAuctions.forEach(d => {
    console.log(JSON.stringify({
      sourceId: d.sourceId,
      name: d.name,
      initialPrice: d.initialPrice,
      province: d.province,
      organizer: d.organizer,
      owner: d.owner,
      publishedAt: d.publishedAt,
      detailScraped: d.detailScraped,
      propertiesCount: d.properties ? d.properties.length : 0,
      createdAt: d.createdAt
    }, null, 2));
  });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
