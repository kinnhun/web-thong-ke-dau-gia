require('dotenv').config();
const mongoose = require('mongoose');
const AuctionNotice = require('./src/models/AuctionNotice');

async function testQuery() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  
  const id1 = 307429;
  const id2 = 570882;
  
  const doc1 = await AuctionNotice.findOne({ sourceId: id1 }).lean();
  const doc2 = await AuctionNotice.findOne({ sourceId: id2 }).lean();
  
  console.log("Doc 1 exists:", !!doc1);
  console.log("Doc 2 exists:", !!doc2);

  if (!doc1 || !doc2) {
    process.exit(0);
  }

  const { searchDuplicatesByFuzzyName } = require('./src/scrapers/detail.scraper');
  const related = await searchDuplicatesByFuzzyName(doc1.sourceId, doc1.name, 'auction');
  console.log("Related from searchDuplicatesByFuzzyName:", related);

  process.exit(0);
}

testQuery().catch(console.error);
