const { fetchAPI } = require('../bot-crawls-data/src/browser');

async function check() {
  try {
    const propResult = await fetchAPI('/portal/propertyInfo', { auctionInfoId: 573235 });
    const viewResult = await fetchAPI('/portal/viewDetailAuctionInfo', { auctionInfoId: 573235 });

    console.log('--- PROPERTY INFO ---');
    console.log(JSON.stringify(propResult, null, 2));
    console.log('--- VIEW DETAIL ---');
    console.log(JSON.stringify(viewResult, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
