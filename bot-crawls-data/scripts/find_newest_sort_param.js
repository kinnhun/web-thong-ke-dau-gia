const { fetchAPI, closeBrowser } = require('../src/browser');

async function findNewestSort() {
  console.log('🔍 Testing various sort parameters on dgts.moj.gov.vn API...');

  const paramsToTest = [
    { typeOrder: 1 },
    { typeOrder: 2 },
    { typeOrder: 3 },
    { typeOrder: 4 },
    { typeOrder: 0 },
    { sortType: 1 },
    { sortType: 2 },
    { orderBy: 'desc' },
    { order: 'desc' },
    {} // no params
  ];

  for (const params of paramsToTest) {
    try {
      const res = await fetchAPI('/portal/search/auction-notice', { p: 1, numberPerPage: 3, ...params });
      const firstItem = res?.items?.[0];
      console.log(`Params: ${JSON.stringify(params)} -> Total: ${res?.totalItem} | First ID: ${firstItem?.id} | Name: ${firstItem?.propertyName?.substring(0, 35)} | pub1: ${firstItem?.publishTime1}`);
    } catch (err) {
      console.log(`Params: ${JSON.stringify(params)} -> Error: ${err.message}`);
    }
  }

  await closeBrowser();
}

findNewestSort().catch(console.error);
