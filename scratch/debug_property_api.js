const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');
const { fetchAPI } = require('../bot-crawls-data/src/browser');

async function debug() {
  await connectDB();
  try {
    // Tìm các document đã detailScraped: true nhưng properties có startPrice = 0 hoặc rỗng
    const docs = await AuctionNotice.find({
      detailScraped: true,
      $or: [
        { initialPrice: { $exists: false } },
        { initialPrice: null },
        { initialPrice: 0 }
      ],
      properties: { $exists: true, $not: { $size: 0 } }
    }).limit(2).lean();

    console.log('Found docs with properties but missing price:', docs.map(d => ({ sourceId: d.sourceId, propertiesCount: d.properties.length })));

    for (const doc of docs) {
      console.log(`\n=================== sourceId: ${doc.sourceId} ===================`);
      console.log('Saved properties in DB:', JSON.stringify(doc.properties, null, 2));

      console.log('Calling propertyInfo API...');
      const res = await fetchAPI('/portal/propertyInfo', { auctionInfoId: doc.sourceId });
      console.log('API Response items count:', res?.items?.length);
      if (res && res.items && res.items.length > 0) {
        console.log('First item keys:', Object.keys(res.items[0]));
        console.log('First item full JSON:', JSON.stringify(res.items[0], null, 2));
      }
    }
  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

debug();
