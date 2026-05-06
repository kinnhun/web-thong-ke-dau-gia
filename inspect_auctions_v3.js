const mongoose = require('/var/www/web-thong-ke-dau-gia/node_modules/mongoose');
const AuctionNotice = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/models/AuctionNotice');

async function inspect() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  
  const ids = [382830, 414997];
  const items = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();
  
  console.log('--- DB Inspection ---');
  items.forEach(item => {
    console.log(`\nID: ${item.sourceId}`);
    // console.log(`Name: ${item.name}`); // Long name might flood console
    console.log(`Province: "${item.province}"`);
    console.log(`Organizer: "${item.organizer}"`);
    console.log(`Detail Scraped: ${item.detailScraped}`);
    console.log(`Related IDs: ${JSON.stringify(item.relatedIds)}`);
  });
  
  await mongoose.disconnect();
}

inspect().catch(console.error);
