require('dotenv').config({ path: 'bot-crawls-data/.env' });
const { AuctionNotice, connectDB } = require('../bot-crawls-data/src/db');
connectDB().then(async () => {
  const items = await AuctionNotice.find({ sourceId: { $in: [310238, 382830, 564179] } })
    .select('sourceId name province')
    .lean();
  console.log('Items in DB:');
  items.forEach(item => {
    console.log(`- ID: ${item.sourceId}, Province: ${item.province}`);
  });
  process.exit(0);
}).catch(console.error);
