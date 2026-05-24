const mongoose = require('mongoose');
const { connectDB } = require('../bot-crawls-data/src/db');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');
const { fetchAPI } = require('../bot-crawls-data/src/browser');

async function test() {
  await connectDB();
  try {
    const items = await AuctionNotice.find({
      detailScraped: true,
      $or: [
        { properties: { $exists: false } },
        { properties: { $size: 0 } }
      ]
    }).limit(3).lean();

    console.log('Samples from DB:');
    console.log(JSON.stringify(items.map(i => ({ sourceId: i.sourceId, name: i.name, sourceUrl: i.sourceUrl })), null, 2));

    for (const item of items) {
      console.log(`\n================= SourceId: ${item.sourceId} =================`);
      const propResult = await fetchAPI('/portal/propertyInfo', { auctionInfoId: item.sourceId });
      const viewResult = await fetchAPI('/portal/viewDetailAuctionInfo', { auctionInfoId: item.sourceId });
      console.log('propertyInfo items count:', propResult?.items?.length || 0);
      console.log('viewDetail propertyStartPrice:', viewResult?.propertyStartPrice);
      console.log('viewDetail listFile count:', viewResult?.listFile?.length || 0);
    }

  } catch (err) {
    console.error(err);
  }
  mongoose.disconnect();
}

test();
