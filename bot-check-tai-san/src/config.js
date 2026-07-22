require('dotenv').config();

module.exports = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/thong_ke_dau_gia',
  },
  baseUrl: process.env.BASE_URL || 'https://dgts.moj.gov.vn',
  apiPort: parseInt(process.env.API_PORT || '4400', 10),
  proxyServer: process.env.PROXY_SERVER || '',
  crawl: {
    pageSize: parseInt(process.env.CRAWL_PAGE_SIZE || '100', 10),
    concurrency: parseInt(process.env.CRAWL_CONCURRENCY || '5', 10),
    delayMs: parseInt(process.env.CRAWL_DELAY_MS || '200', 10),
    endpoint: '/portal/search/auction-notice',
  },
};
