require('dotenv').config({ path: 'bot-crawls-data/.env' });
const { AuctionNotice, connectDB } = require('../bot-crawls-data/src/db');
connectDB().then(async () => {
  const item = await AuctionNotice.findOne({ sourceId: 561763 }).lean();
  console.log('sourceUrl:', item?.sourceUrl);
  process.exit(0);
}).catch(console.error);
