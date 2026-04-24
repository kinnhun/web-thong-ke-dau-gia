require('dotenv').config();

module.exports = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/thong_ke_dau_gia',
  },
  crawl: {
    concurrency: parseInt(process.env.CRAWL_CONCURRENCY || '5', 10),
    delayMs: parseInt(process.env.CRAWL_DELAY_MS || '300', 10),
    pageSize: parseInt(process.env.CRAWL_PAGE_SIZE || '100', 10),
    maxPages: parseInt(process.env.CRAWL_MAX_PAGES || '0', 10), // 0 = unlimited
    // Gặp N bản ghi cũ liên tiếp → dừng, vì đã cào hết data mới
    skipThreshold: parseInt(process.env.CRAWL_SKIP_THRESHOLD || '20', 10),
  },
  api: {
    port: parseInt(process.env.API_PORT || '4000', 10),
  },
  baseUrl: process.env.BASE_URL || 'https://dgts.moj.gov.vn',
  cron: process.env.CRON_SCHEDULE || '*/15 * * * *', // Mỗi 15 phút

  // API endpoints
  endpoints: {
    auctionNoticeList: '/portal/search/auction-notice',
    orgSelectionList: '/ThongTin/getInfoSelectAuctionOrg',
    propertyTypes: '/common/getListPropertyType',
    provinces: '/common/getListProvince',
    districts: '/common/getListDistrict',
    auctionDetailBase: '/thong-bao-cong-khai-viec-dau-gia',
    orgDetailBase: '/thong-bao-lua-chon-to-chuc-dau-gia',
  },
};
