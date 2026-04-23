const { connectDB } = require('./src/db');
const AuctionNotice = require('./src/models/AuctionNotice');
const OrgSelection = require('./src/models/OrgSelection');

async function main() {
  await connectDB();
  const res1 = await AuctionNotice.updateMany({}, { detailScraped: false });
  const res2 = await OrgSelection.updateMany({}, { detailScraped: false });
  console.log('Đã reset trạng thái detailScraped cho', res1.modifiedCount, 'AuctionNotice và', res2.modifiedCount, 'OrgSelection');
  process.exit(0);
}

main().catch(console.error);
