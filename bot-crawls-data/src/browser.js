/**
 * Browser manager dùng Puppeteer để bypass FEC anti-bot protection
 * Site dgts.moj.gov.vn dùng FEC (Front-End Challenge)
 * Chạy browser ở chế độ visible để pass challenge
 */
const puppeteer = require('puppeteer');
const config = require('./config');

let browser = null;
let page = null;
let isReady = false;

/**
 * Khởi tạo browser và pass FEC challenge
 */
async function initBrowser() {
  if (browser && isReady) return page;

  console.log('🌐 Đang khởi tạo browser (headless mode)...');
  browser = await puppeteer.launch({
    headless: 'new', // Chrome headless mới — nhanh hơn, vẫn pass FEC
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900',
    ],
    defaultViewport: null,
  });

  page = (await browser.pages())[0] || await browser.newPage();

  // Ẩn webdriver flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['vi-VN', 'vi', 'en-US', 'en'],
    });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  // Navigate to main page - FEC challenge sẽ tự pass trong visible mode
  console.log('🔑 Đang truy cập trang web...');
  
  try {
    await page.goto(`${config.baseUrl}/thong-bao-cong-khai-viec-dau-gia.html`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
  } catch (e) {
    console.log('  ⏳ Trang tải lâu, đợi thêm...');
  }

  // Wait for page to stabilize after FEC challenge
  await waitForRealPage(page);

  // Test API
  const testResult = await page.evaluate(async (baseUrl) => {
    try {
      const res = await fetch(`${baseUrl}/portal/search/auction-notice?p=1&numberPerPage=1`, {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      });
      if (!res.ok) return { ok: false, status: res.status };
      const data = await res.json();
      return { ok: true, total: data.totalItem, fields: data.items?.[0] ? Object.keys(data.items[0]) : [] };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, config.baseUrl);

  console.log(`  🧪 API test: ${JSON.stringify(testResult)}`);

  if (testResult.ok) {
    isReady = true;
    console.log(`✅ Browser sẵn sàng! Tổng ${testResult.total} thông báo đấu giá`);
  } else {
    // Thử lại - có thể FEC cần thêm thời gian
    console.log('  ⏳ Đợi thêm 10s cho FEC hoàn thành...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Reload
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await waitForRealPage(page);
    
    isReady = true;
    console.log('✅ Browser sẵn sàng (fallback)');
  }

  return page;
}

/**
 * Đợi cho trang thật sự load (không còn FEC challenge)
 */
async function waitForRealPage(p, maxWait = 30000) {
  const start = Date.now();
  
  while (Date.now() - start < maxWait) {
    const hasFEC = await p.evaluate(() => {
      return document.body.innerHTML.includes('fec_wrapper') || 
             document.body.innerHTML.includes('_fec_sbu') ||
             document.title.includes('403');
    });
    
    if (!hasFEC) {
      const title = await p.title();
      console.log(`  📋 Trang đã load: "${title}"`);
      return true;
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('  ⚠️ Timeout chờ FEC');
  return false;
}

/**
 * Fetch JSON từ API thông qua browser (bypass FEC)
 */
async function fetchAPI(endpoint, params = {}) {
  const p = await initBrowser();

  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const url = `${config.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;

  const result = await p.evaluate(async (fetchUrl) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(fetchUrl, {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { error: true, status: res.status, message: `HTTP ${res.status}` };
      }

      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return { error: false, data };
      } catch (e) {
        return { error: true, message: 'Invalid JSON: ' + text.substring(0, 200) };
      }
    } catch (err) {
      return { error: true, message: err.message };
    }
  }, url);

  if (result.error) {
    throw new Error(`API Error: ${result.message || result.status}`);
  }

  return result.data;
}

/**
 * Fetch HTML detail page thông qua browser
 */
async function fetchDetailHTML(url) {
  const p = await initBrowser();

  const result = await p.evaluate(async (fetchUrl) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(fetchUrl, {
        headers: { 'Accept': 'text/html' },
        credentials: 'same-origin',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) return { error: true, status: res.status };
      const html = await res.text();
      return { error: false, html };
    } catch (err) {
      return { error: true, message: err.message };
    }
  }, url);

  if (result.error) {
    throw new Error(`Detail fetch error: ${result.message || result.status}`);
  }

  return result.html;
}

/**
 * Đóng browser
 */
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    isReady = false;
    console.log('🔒 Browser đã đóng');
  }
}

module.exports = { initBrowser, fetchAPI, fetchDetailHTML, closeBrowser };
