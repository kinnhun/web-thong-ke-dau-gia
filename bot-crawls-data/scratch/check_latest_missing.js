const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const OrgSelection = require('../src/models/OrgSelection');

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', {
    serverSelectionTimeoutMS: 5000,
  });

  console.log('=== LATEST 10 AUCTION NOTICES (by _id) ===');
  const auctions = await AuctionNotice.find().sort({ _id: -1 }).limit(10).lean();
  auctions.forEach(a => {
    console.log(`ID: ${a.sourceId} | name: "${(a.name || '').substring(0, 40)}" | initialPrice: ${a.initialPrice} | detailScraped: ${a.detailScraped} | createdAt: ${a.createdAt}`);
  });

  console.log('\n=== LATEST 10 ORG SELECTIONS (by _id) ===');
  const orgs = await OrgSelection.find().sort({ _id: -1 }).limit(10).lean();
  orgs.forEach(o => {
    console.log(`ID: ${o.sourceId} | name: "${(o.name || '').substring(0, 40)}" | startingPrice: ${o.startingPrice} | detailScraped: ${o.detailScraped} | createdAt: ${o.createdAt}`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
