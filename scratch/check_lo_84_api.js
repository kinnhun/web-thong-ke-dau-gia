const { fetchAPI } = require('../bot-crawls-data/src/browser');

async function debug() {
  try {
    const sourceId = 491571;
    console.log(`Calling propertyInfo for sourceId ${sourceId}...`);
    const res = await fetchAPI('/portal/propertyInfo', { auctionInfoId: sourceId });
    console.log('Response:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
}

debug();
