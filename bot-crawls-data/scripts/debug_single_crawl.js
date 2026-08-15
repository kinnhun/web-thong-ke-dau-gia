const { connectDB, closeDB } = require('../src/db');
const { fetchAPI, closeBrowser } = require('../src/browser');
const AuctionNotice = require('../src/models/AuctionNotice');
const { mapAssetType, slugify, parseDate } = require('../src/utils/helpers');

async function debugSingleCrawl() {
  await connectDB();
  console.log('✅ Connected DB');

  try {
    const res = await fetchAPI('/portal/search/auction-notice', { p: 1, numberPerPage: 5, typeOrder: 2 });
    if (!res || !res.items) {
      console.log('❌ API no items');
      return;
    }

    console.log(`Received ${res.items.length} items from page 1:`);
    for (const item of res.items) {
      const sourceId = Number(item.id);
      console.log(`\nItem ID: ${sourceId} | Title: ${item.propertyName}`);

      const data = {
        sourceId,
        name: item.propertyName || item.titleName || '',
        shortDescription: item.subPropertyName || '',
        slug: slugify(item.propertyName || ''),
        type: mapAssetType(item.propertyTypeName, item.propertyName),
        publishedAt: parseDate(item.publishTime1) || parseDate(item.publishTime2) || parseDate(item.publishedAt),
        sourceUrl: `https://dgts.moj.gov.vn/thong-bao-cong-khai-viec-dau-gia/${item.id}.html`
      };

      console.log('Data to insert:', data);

      try {
        await AuctionNotice.deleteOne({ sourceId });
        const created = await AuctionNotice.create(data);
        console.log('✅ Successfully created in DB:', created._id, 'sourceId:', created.sourceId, 'publishedAt:', created.publishedAt);
      } catch (err) {
        console.error('❌ Insert error:', err);
      }
    }
  } catch (err) {
    console.error('❌ General error:', err);
  } finally {
    await closeBrowser();
    await closeDB();
  }
}

debugSingleCrawl().catch(console.error);
