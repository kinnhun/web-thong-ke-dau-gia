const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', {
    serverSelectionTimeoutMS: 5000,
  });

  console.log('Querying latest 15 AuctionNotice items...');
  const items = await AuctionNotice.find().sort({ _id: -1 }).limit(15).lean();
  
  console.log(`Found ${items.length} items:`);
  items.forEach(d => {
    console.log(`--- ID: ${d.sourceId} ---`);
    console.log(`  name: ${JSON.stringify(d.name)}`);
    console.log(`  initialPrice: ${d.initialPrice}`);
    console.log(`  province: ${JSON.stringify(d.province)}`);
    console.log(`  organizer: ${JSON.stringify(d.organizer)}`);
    console.log(`  owner: ${JSON.stringify(d.owner)}`);
    console.log(`  publishedAt: ${d.publishedAt}`);
    console.log(`  detailScraped: ${d.detailScraped}`);
    console.log(`  properties: ${d.properties ? d.properties.length : 0} items`);
    console.log(`  createdAt: ${d.createdAt}`);
  });

  const incomplete = await AuctionNotice.find({ detailScraped: { $ne: true } }).sort({ _id: -1 }).limit(5).lean();
  console.log(`\nFound ${incomplete.length} incomplete items (detailScraped != true):`);
  incomplete.forEach(d => {
    console.log(`--- ID: ${d.sourceId} ---`);
    console.log(`  name: ${JSON.stringify(d.name)}`);
    console.log(`  initialPrice: ${d.initialPrice}`);
    console.log(`  createdAt: ${d.createdAt}`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
