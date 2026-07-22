const puppeteer = require('puppeteer');
const config = require('./config');

let browser = null;
let page = null;
let isReady = false;
let requestCount = 0;
const MAX_REQUESTS_BEFORE_RESTART = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupBrowser() {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {}
  }
  browser = null;
  page = null;
  isReady = false;
}

async function initBrowser() {
  if (browser && isReady && page && !page.isClosed()) {
    return page;
  }

  await cleanupBrowser();

  console.log('🌐 [Bot Check ID] Đang khởi tạo Puppeteer browser...');
  
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,900',
  ];

  if (config.proxyServer) {
    console.log(`🌐 Sử dụng Proxy Server: ${config.proxyServer}`);
    args.push(`--proxy-server=${config.proxyServer}`);
  }

  // Thử khởi tạo với Chrome cài sẵn hoặc Puppeteer Chromium
  const launchOptions = {
    headless: 'new',
    args,
    defaultViewport: null,
  };

  // Thử dùng Chrome local nếu có
  try {
    browser = await puppeteer.launch({
      ...launchOptions,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
  } catch (e) {
    browser = await puppeteer.launch(launchOptions);
  }

  page = await browser.newPage();
  
  // Abort media/images để tăng tốc
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      req.abort().catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  console.log('🔑 Đang vượt rào FEC Anti-bot tại dgts.moj.gov.vn...');
  await page.goto(`${config.baseUrl}/thong-bao-cong-khai-viec-dau-gia.html`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  // Chờ trang vượt FEC challenge
  let loaded = false;
  for (let i = 0; i < 15; i++) {
    const hasFEC = await page.evaluate(() => {
      return document.body.innerHTML.includes('fec_wrapper') ||
        document.body.innerHTML.includes('_fec_sbu') ||
        document.title.includes('403');
    });

    if (!hasFEC) {
      loaded = true;
      break;
    }
    await sleep(2000);
  }

  if (!loaded) {
    console.log('⏳ Đợi thêm 10s & Reload để pass FEC...');
    await sleep(5000);
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  }

  // Test fetch API thử nghiệm
  const testRes = await page.evaluate(async (baseUrl) => {
    try {
      const res = await fetch(`${baseUrl}/portal/search/auction-notice?p=1&numberPerPage=1&typeOrder=2`, {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      });
      if (!res.ok) return { ok: false, status: res.status };
      const data = await res.json();
      return { ok: true, total: data.totalItem, rowCount: data.rowCount, pageCount: data.pageCount };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, config.baseUrl);

  if (!testRes.ok) {
    throw new Error(`Bypass FEC thất bại: ${testRes.error || testRes.status}`);
  }

  console.log(`✅ Bypass FEC thành công! Tổng số bản ghi trên hệ thống: ${testRes.total} (Số trang: ${testRes.pageCount})`);
  isReady = true;
  return page;
}

const { logApiCall } = require('./logger');

/**
 * Fetch một trang danh sách auction notices thông qua Puppeteer context
 */
async function fetchNoticePage(pageNumber, pageSize = 100, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const startTime = Date.now();
    const url = `${config.baseUrl}${config.crawl.endpoint}?p=${pageNumber}&numberPerPage=${pageSize}&typeOrder=2`;

    try {
      const activePage = await initBrowser();

      const result = await activePage.evaluate(async (fetchUrl) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const res = await fetch(fetchUrl, {
            headers: {
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const isRateLimit = res.status === 403 || res.status === 429;
            return { error: true, status: res.status, isRateLimit, message: `HTTP ${res.status}` };
          }

          const text = await res.text();
          const data = JSON.parse(text);
          return { error: false, data };
        } catch (err) {
          return { error: true, message: err.message };
        }
      }, url);

      const durationMs = Date.now() - startTime;

      if (result.error) {
        logApiCall({
          pageNumber,
          url,
          attempt,
          success: false,
          statusCode: result.status || 500,
          durationMs,
          error: result.message,
        });

        if (result.isRateLimit) {
          console.warn(`⚠️ Phát hiện bị giới hạn tần suất HTTP ${result.status} tại trang ${pageNumber}! Đang tạm nghỉ 15 giây...`);
          isReady = false;
          await sleep(15000);
        }
        throw new Error(result.message);
      }

      const itemCount = Array.isArray(result.data?.items) ? result.data.items.length : 0;
      logApiCall({
        pageNumber,
        url,
        attempt,
        success: true,
        statusCode: 200,
        itemCount,
        durationMs,
      });

      requestCount++;
      if (requestCount >= MAX_REQUESTS_BEFORE_RESTART) {
        requestCount = 0;
        console.log(`🔄 Auto-restart browser sau ${MAX_REQUESTS_BEFORE_RESTART} requests...`);
        cleanupBrowser().catch(() => {});
      }

      return result.data;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (attempt === retries) {
        logApiCall({
          pageNumber,
          url,
          attempt,
          success: false,
          durationMs,
          error: err.message,
        });
        throw err;
      }
      console.warn(`⚠️ Trang ${pageNumber} thử lại lần ${attempt}/${retries}: ${err.message}`);
      isReady = false;
      await sleep(3000 * attempt);
    }
  }
}

async function closeBrowser() {
  await cleanupBrowser();
  console.log('🔒 Browser đã đóng');
}

module.exports = { initBrowser, fetchNoticePage, closeBrowser };
