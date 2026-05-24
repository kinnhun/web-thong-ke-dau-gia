const { fetchAPI } = require('../bot-crawls-data/src/browser');

async function debug() {
  try {
    console.log('Fetching first page of auction notice list...');
    const res = await fetchAPI('/portal/search/auction-notice', { p: 1, numberPerPage: 5, typeOrder: 2 });
    if (res && res.items && res.items.length > 0) {
      console.log('Sample item keys:', Object.keys(res.items[0]));
      console.log('Sample item full JSON:', JSON.stringify(res.items[0], null, 2));
    } else {
      console.log('No items returned');
    }
  } catch (err) {
    console.error(err);
  }
}

debug();
