const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const OrgSelection = require('../src/models/OrgSelection');

async function main() {
  await connectDB();
  console.log('Connected to DB');

  const totalAuctions = await AuctionNotice.countDocuments();
  const totalOrgs = await OrgSelection.countDocuments();

  const missingAuctionDetail = await AuctionNotice.countDocuments({ detailScraped: { $ne: true } });
  const missingOrgDetail = await OrgSelection.countDocuments({ detailScraped: { $ne: true } });

  const auctionNoName = await AuctionNotice.countDocuments({ $or: [{ name: { $exists: false } }, { name: '' }, { name: null }] });
  const auctionNoPrice = await AuctionNotice.countDocuments({ $or: [{ initialPrice: { $exists: false } }, { initialPrice: null }, { initialPrice: 0 }] });
  const auctionNoOrganizer = await AuctionNotice.countDocuments({ $or: [{ organizer: { $exists: false } }, { organizer: '' }, { organizer: null }] });

  console.log('\n=== AUCTION NOTICES STATS ===');
  console.log('Total:', totalAuctions);
  console.log('Missing detail (detailScraped != true):', missingAuctionDetail);
  console.log('Missing name:', auctionNoName);
  console.log('Missing initialPrice (0 or null):', auctionNoPrice);
  console.log('Missing organizer:', auctionNoOrganizer);

  console.log('\n=== LATEST 10 AUCTION NOTICES ===');
  const latestAuctions = await AuctionNotice.find().sort({ createdAt: -1 }).limit(10).lean();
  latestAuctions.forEach(d => {
    console.log(`[sourceId: ${d.sourceId}]`);
    console.log(`  name: "${d.name || ''}"`);
    console.log(`  initialPrice: ${d.initialPrice}`);
    console.log(`  province: "${d.province || ''}"`);
    console.log(`  organizer: "${d.organizer || ''}"`);
    console.log(`  owner: "${d.owner || ''}"`);
    console.log(`  publishedAt: ${d.publishedAt}`);
    console.log(`  detailScraped: ${d.detailScraped}`);
    console.log(`  createdAt: ${d.createdAt}`);
  });

  console.log('\n=== LATEST 10 ORG SELECTIONS ===');
  const latestOrgs = await OrgSelection.find().sort({ createdAt: -1 }).limit(10).lean();
  latestOrgs.forEach(d => {
    console.log(`[sourceId: ${d.sourceId}]`);
    console.log(`  name: "${d.name || ''}"`);
    console.log(`  province: "${d.province || ''}"`);
    console.log(`  organizer: "${d.organizer || ''}"`);
    console.log(`  detailScraped: ${d.detailScraped}`);
    console.log(`  createdAt: ${d.createdAt}`);
  });

  await closeDB();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
