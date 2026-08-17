/**
 * Browser manager dùng Puppeteer để bypass FEC anti-bot protection
 * Site dgts.moj.gov.vn dùng FEC (Front-End Challenge)
 * Chạy browser ở chế độ visible để pass challenge
 */
const puppeteer = require('puppeteer');
const path = require('path');
const config = require('./config');

let browser = null;
let page = null;
let isReady = false;
let requestChain = Promise.resolve();
let contextLock = Promise.resolve();
let requestCount = 0;
const MAX_REQUESTS_BEFORE_RESTART = 3000; // Restart browser after N requests to prevent memory leaks

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
      req.abort().catch(() => { });
      return;
    }

    req.continue().catch(() => { });
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

const fs = require('fs');

function getExecutablePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ];
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined; // Puppeteer fallback to bundled Chromium
}

async function ensureBrowserContext(forceReset = false) {
  // Lock này chỉ dùng để bảo vệ việc khởi tạo/reset browser/page
  const currentLock = contextLock;
  
  const nextTask = (async () => {
    await currentLock; // Đợi các tác vụ khởi tạo trước đó xong

    if (forceReset) {
      await cleanupPage(page);
      page = null;
      isReady = false;
    }

    if (!browser) {
      console.log('🌐 Đang khởi tạo trình duyệt (Headless Mode)...');
      const exePath = getExecutablePath();
      browser = await puppeteer.launch({
        ...(exePath ? { executablePath: exePath } : {}),
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
  })();

  contextLock = nextTask.catch(() => {});
  return nextTask;
}

async function evaluateWithRecovery(executor, label, retries = 2) {
  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      // Chỉ lock phần chuẩn bị context, không lock phần thực thi executor
      const activePage = await ensureBrowserContext(attempt > 1);
      return await executor(activePage);
    } catch (error) {
      lastError = error;

      if (!isRecoverablePageError(error) || attempt > retries) {
        throw error;
      }

      console.warn(`⚠️ ${label} lỗi page lifecycle (lần ${attempt}/${retries + 1}): ${error.message}`);
      await sleep(1500 * attempt);
    }
  }

  throw lastError;
}

async function runSerialized(executor) {
  const nextTask = requestChain.then(executor, executor);
  requestChain = nextTask.catch(() => { });
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
      console.log(`  🔑 Đang vượt rào Anti-Bot (Front-End Challenge), vui lòng chờ 5-10 giây...`);
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
async function fetchAPI(endpoint, params = {}, maxRetries = 2, extraHeaders = {}) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    await initBrowser();

    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    const url = `${config.baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;

    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      ...extraHeaders,
    };

    if (!headers.Referer && !headers.referer) {
      const infoId = params.auctionInfoId || params.id;
      if (infoId) {
        if (endpoint.includes('SelectAuctionOrg') || endpoint.includes('EditNotice')) {
          headers['Referer'] = `${config.baseUrl}/thong-bao-lua-chon-to-chuc-dau-gia/detail-${infoId}.html`;
        } else {
          headers['Referer'] = `${config.baseUrl}/thong-bao-cong-khai-viec-dau-gia/detail-${infoId}.html`;
        }
      }
    }

    const result = await evaluateWithRecovery(async (activePage) => activePage.evaluate(async (fetchUrl, reqHeaders) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(fetchUrl, {
          headers: reqHeaders,
          credentials: 'same-origin',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const isAuthError = res.status === 406 || res.status === 403;
          return { error: true, status: res.status, isAuthError, message: `API Error: HTTP ${res.status} on ${fetchUrl.split('?')[0]}` };
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
    }, url), `Fetch API ${endpoint}`, 1);

    if (result.error) {
      if (result.isAuthError && attempt <= maxRetries) {
        console.warn(`⚠️ HTTP ${result.status} (Cookie/Session hết hạn), đang tải lại trang để lấy Cookie mới... (lần ${attempt}/${maxRetries})`);
        isReady = false; // Ép buộc initBrowser() ở vòng lặp tiếp theo phải chạy lại
        continue;
      }
      throw new Error(`${result.message || result.status}`);
    }

    // ★ Auto-restart browser sau mỗi N requests để giải phóng memory
    requestCount++;
    if (requestCount >= MAX_REQUESTS_BEFORE_RESTART) {
      requestCount = 0;
      console.log(`🔄 Browser auto-restart sau ${MAX_REQUESTS_BEFORE_RESTART} requests`);
      // Schedule restart (không block hiện tại)
      setTimeout(async () => {
        try {
          await cleanupBrowser();
        } catch (e) { }
      }, 100);
    }

    return result.data;
  }
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
