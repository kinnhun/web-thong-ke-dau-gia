const { initBrowser, fetchAPI, closeBrowser } = require('./bot-crawls-data/src/browser');

async function run() {
  console.log('Initializing browser to query portal APIs...');
  try {
    // Let's call pageAuctionInfoPublish2 for both
    const id1 = 570261;
    const id2 = 121662;

    console.log(`\nFetching publish history for ID ${id1}...`);
    const history1 = await fetchAPI('/portal/pageAuctionInfoPublish2', { auctionInfoId: id1, p: 0 });
    console.log('Result for 570261:');
    console.log(JSON.stringify(history1, null, 2));

    console.log(`\nFetching publish history for ID ${id2}...`);
    const history2 = await fetchAPI('/portal/pageAuctionInfoPublish2', { auctionInfoId: id2, p: 0 });
    console.log('Result for 121662:');
    console.log(JSON.stringify(history2, null, 2));

  } catch (err) {
    console.error('Error fetching from portal:', err);
  } finally {
    await closeBrowser();
  }
}

run().catch(console.error);
