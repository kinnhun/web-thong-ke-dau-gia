const { initBrowser, fetchAPI, closeBrowser } = require('../src/browser');

async function testApiSort() {
  console.log('🧪 Đang test API portal/search/auction-notice với các tham số sắp xếp khác nhau...');
  
  // Test p=1, typeOrder=2 (mặc định trong scraper cũ)
  const res1 = await fetchAPI('/portal/search/auction-notice', { p: 1, numberPerPage: 10, typeOrder: 2 });
  console.log('\n--- TYPE ORDER 2 (p=1) ---');
  if (res1 && res1.items) {
    res1.items.forEach(item => {
      console.log(`ID: ${item.id} | Name: ${item.propertyName?.substring(0, 30)} | pub1: ${item.publishTime1} | pub2: ${item.publishTime2} | create: ${item.createdDate}`);
    });
  }

  // Test p=1, typeOrder=1 (hoặc sort khác)
  const res2 = await fetchAPI('/portal/search/auction-notice', { p: 1, numberPerPage: 10, typeOrder: 1 });
  console.log('\n--- TYPE ORDER 1 (p=1) ---');
  if (res2 && res2.items) {
    res2.items.forEach(item => {
      console.log(`ID: ${item.id} | Name: ${item.propertyName?.substring(0, 30)} | pub1: ${item.publishTime1} | pub2: ${item.publishTime2} | create: ${item.createdDate}`);
    });
  }

  // Test tìm kiếm trực tiếp theo ngày 12/08/2026:
  const res3 = await fetchAPI('/portal/search/auction-notice', {
    p: 1,
    numberPerPage: 10,
    publishTime1: '12/08/2026',
    publishTime2: '12/08/2026'
  });
  console.log('\n--- SEARCH DIRECT 12/08/2026 ---');
  console.log(`Total items on 12/08/2026: ${res3?.totalItem || 0}`);
  if (res3 && res3.items) {
    res3.items.forEach(item => {
      console.log(`ID: ${item.id} | Name: ${item.propertyName?.substring(0, 30)} | pub1: ${item.publishTime1} | pub2: ${item.publishTime2}`);
    });
  }

  await closeBrowser();
}

testApiSort().catch(console.error);
