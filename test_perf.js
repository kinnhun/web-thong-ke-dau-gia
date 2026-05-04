require('dotenv').config({ path: './bot-crawls-data/.env' });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const start = Date.now();
  const noticeMatch = { status: 'completed' };
  
  const matchingNotices = await require('./bot-crawls-data/src/models/AuctionNotice')
    .find(noticeMatch)
    .select('sourceId')
    .lean();
    
  const noticeSourceIds = matchingNotices.map(n => n.sourceId);
  console.log('Found', noticeSourceIds.length, 'notices in', Date.now()-start, 'ms');
  
  const dupFilter = { type: 'auction', relistCount: { $gt: 1 }, sourceIds: { $in: noticeSourceIds } };
  const dups = await require('./bot-crawls-data/src/models/Duplicate').countDocuments(dupFilter);
  
  console.log('Dups:', dups, 'in', Date.now()-start, 'ms');
  await mongoose.disconnect();
}
test().catch(console.error);
