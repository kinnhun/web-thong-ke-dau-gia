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
let requestChain = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecoverablePageError(error) {
  const message = error?.message || '';
  return [
    'detached Frame',
    'Attempted to use detached Frame',
    'Execution context was destroyed',
    'Cannot find context with specified id',
    'Target closed',
    'Session closed',
    'Protocol error',
  ].some((token) => message.includes(token));
}

async function isPageUsable(targetPage) {
  if (!targetPage) return false;

  try {
    if (targetPage.isClosed()) return false;
    await targetPage.title();
    return true;
  } catch (error) {
    return !isRecoverablePageError(error) ? false : false;
  }
}

async function cleanupPage(targetPage) {
  if (!targetPage) return;

  try {
    if (!targetPage.isClosed()) {
      await targetPage.close();
    }
  } catch (error) {
    if (!isRecoverablePageError(error)) {
      console.warn(`⚠️ Không thể đóng page cũ: ${error.message}`);
    }
  }
}

async function cleanupBrowser() {
  if (!browser) return;

  try {
    await browser.close();
  } catch (error) {
    console.warn(`⚠️ Không thể đóng browser cũ: ${error.message}`);
  }

  browser = null;
  page = null;
  isReady = false;
}

async function createManagedPage() {
  const existingPages = await browser.pages();

  await Promise.allSettled(existingPages.map(async (existingPage) => {
    try {
      if (!existingPage.isClosed()) {
        await existingPage.close();
      }
    } catch (error) {
      console.warn(`⚠️ Không thể đóng startup page: ${error.message}`);
    }
  }));

  const nextPage = await browser.newPage();

  await nextPage.setRequestInterception(true);
  nextPage.on('request', (req) => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      req.abort().catch(() => {});
      return;
    }

    req.continue().catch(() => {});
  });

  nextPage.on('close', () => {
    if (page === nextPage) {
      isReady = false;
    }
  });

  await nextPage.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['vi-VN', 'vi', 'en-US', 'en'],
    });
  });

  await nextPage.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  page = nextPage;
  return nextPage;
}

async function ensureBrowserContext(forceReset = false) {
  if (forceReset) {
    await cleanupPage(page);
    page = null;
    isReady = false;
  }

  if (!browser) {
    console.log('🌐 Đang khởi tạo browser (headless mode)...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,900',
      ],
      defaultViewport: null,
    });
  }

  if (!(await isPageUsable(page))) {
    await cleanupPage(page);
    page = await createManagedPage();
    isReady = false;
  }

  return page;
}

async function evaluateWithRecovery(executor, label, retries = 2) {
  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const activePage = await ensureBrowserContext(attempt > 1);
      return await executor(activePage);
    } catch (error) {
      lastError = error;

      if (!isRecoverablePageError(error) || attempt > retries) {
        throw error;
      }

      console.warn(`⚠️ ${label} lỗi page lifecycle (lần ${attempt}/${retries + 1}): ${error.message}`);
      await cleanupPage(page);
      page = null;
      isReady = false;
      await sleep(1500 * attempt);
    }
  }

  throw lastError;
}

async function runSerialized(executor) {
  const nextTask = requestChain.then(executor, executor);
  requestChain = nextTask.catch(() => {});
  return nextTask;
}

/**
 * Khởi tạo browser và pass FEC challenge
 */
async function initBrowser() {
  if (browser && isReady && await isPageUsable(page)) {
    return page;
  }

  return runSerialized(async () => {
    if (browser && isReady && await isPageUsable(page)) {
      return page;
    }

    const readyPage = await evaluateWithRecovery(async (activePage) => {
      console.log('🔑 Đang truy cập trang web...');

      try {
        await activePage.goto(`${config.baseUrl}/thong-bao-cong-khai-viec-dau-gia.html`, {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });
      } catch (error) {
        console.log('  ⏳ Trang tải lâu, đợi thêm...');
      }

      await waitForRealPage(activePage);

      const testResult = await activePage.evaluate(async (baseUrl) => {
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
        } catch (error) {
          return { ok: false, error: error.message };
        }
      }, config.baseUrl);

      console.log(`  🧪 API test: ${JSON.stringify(testResult)}`);

      if (!testResult.ok) {
        console.log('  ⏳ Đợi thêm 10s cho FEC hoàn thành...');
        await sleep(10000);
        await activePage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
        await waitForRealPage(activePage);
      }

      return activePage;
    }, 'Khởi tạo browser', 2);

    page = readyPage;
    isReady = true;
    console.log('✅ Browser sẵn sàng!');
    return page;
  });
}

/**
 * Đợi cho trang thật sự load (không còn FEC challenge)
 */
async function waitForRealPage(targetPage, maxWait = 30000) {
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const hasFEC = await evaluateWithRecovery(
      async (activePage) => activePage.evaluate(() => {
        return document.body.innerHTML.includes('fec_wrapper') ||
          document.body.innerHTML.includes('_fec_sbu') ||
          document.title.includes('403');
      }),
      'Kiểm tra FEC',
      1
    );

    if (!hasFEC) {
      const title = await evaluateWithRecovery((activePage) => activePage.title(), 'Đọc title', 1);
      console.log(`  📋 Trang đã load: "${title}"`);
      return true;
    }

    if (!(await isPageUsable(targetPage))) {
      throw new Error('Browser page closed during FEC wait');
    }

    await sleep(2000);
  }

  console.log('  ⚠️ Timeout chờ FEC');
  return false;
}

/**
 * Fetch JSON từ API thông qua browser (bypass FEC)
 */
async function fetchAPI(endpoint, params = {}) {
  await initBrowser();

  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const url = `${config.baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;

  return runSerialized(async () => {
    const result = await evaluateWithRecovery(async (activePage) => activePage.evaluate(async (fetchUrl) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
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
          return { error: true, status: res.status, message: `HTTP ${res.status}` };
        }

        const text = await res.text();
        try {
          const data = JSON.parse(text);
          return { error: false, data };
        } catch (error) {
          return { error: true, message: `Invalid JSON: ${text.substring(0, 200)}` };
        }
      } catch (error) {
        return { error: true, message: error.message };
      }
    }, url), `Fetch API ${endpoint}`, 2);

    if (result.error) {
      throw new Error(`API Error: ${result.message || result.status}`);
    }

    return result.data;
  });
}

/**
 * Fetch HTML detail page thông qua browser
 */
async function fetchDetailHTML(url) {
  await initBrowser();

  return runSerialized(async () => {
    const result = await evaluateWithRecovery(async (activePage) => activePage.evaluate(async (fetchUrl) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(fetchUrl, {
          headers: { 'Accept': 'text/html' },
          credentials: 'same-origin',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) return { error: true, status: res.status };
        const html = await res.text();
        return { error: false, html };
      } catch (error) {
        return { error: true, message: error.message };
      }
    }, url), 'Fetch detail HTML', 2);

    if (result.error) {
      throw new Error(`Detail fetch error: ${result.message || result.status}`);
    }

    return result.html;
  });
}

/**
 * Đóng browser
 */
async function closeBrowser() {
  requestChain = Promise.resolve();
  await cleanupBrowser();
  console.log('🔒 Browser đã đóng');
}

module.exports = { initBrowser, fetchAPI, fetchDetailHTML, closeBrowser };
