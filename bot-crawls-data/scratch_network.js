const { initBrowser } = require('./src/browser');

(async () => {
  const p = await initBrowser();
  
  p.on('response', async (response) => {
    const request = response.request();
    if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
      const url = request.url();
      if (url.includes('/portal/')) {
        console.log('API Call:', url);
        try {
          const text = await response.text();
          if (text.includes('558066') || text.includes('pageCorections')) {
              console.log('Data contains 558066:', text.substring(0, 500));
          }
        } catch(e) {}
      }
    }
  });

  await p.goto('https://dgts.moj.gov.vn/thong-bao-cong-khai-viec-dau-gia/tai-san-thi-hanh-an-theo-quy-dinh-cua-phap-luat-ve-thi-hanh-an-dan-su--561061.html', { waitUntil: 'networkidle2' });
  
  console.log('Done waiting');
  process.exit(0);
})();
