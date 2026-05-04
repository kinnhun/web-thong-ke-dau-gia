require('dotenv').config({ path: 'bot-crawls-data/.env' });
const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const dup = await Duplicate.findOne({ relistCount: { $gt: 1 } });
  const latestSourceId = dup.sourceIds[dup.sourceIds.length - 1];
  const notice = await AuctionNotice.findOne({ sourceId: latestSourceId });
  console.log(notice.registrationStart, notice.registrationEnd);
  mongoose.disconnect();
}
test().catch(console.error);
