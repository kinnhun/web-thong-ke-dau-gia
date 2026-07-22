const fs = require('fs');
const path = require('path');
const RawAuctionId = require('./models/RawAuctionId');
const CrawlState = require('./models/CrawlState');
const { connectDB } = require('./db');

/**
 * Trả về dữ liệu thống kê tổng quan và thông tin kiểm soát
 */
async function getAuditStats() {
  await connectDB();

  const state = await CrawlState.findOne({ jobId: 'full_id_crawl' }).lean() || {
    totalRecords: 589476,
    totalPages: 5895,
    completedCount: 0,
    pagesCompleted: [],
    pagesFailed: [],
    status: 'idle',
  };

  const totalInDB = await RawAuctionId.countDocuments();
  const failedPagesCount = state.pagesFailed ? state.pagesFailed.length : 0;
  const completedPagesCount = state.pagesCompleted ? state.pagesCompleted.length : 0;
  const expectedTotalPages = state.totalPages || 5895;

  return {
    serverTotalTarget: state.totalRecords || 589476,
    expectedTotalPages,
    totalInDB,
    totalApiCalls: state.totalApiCalls || 0,
    successfulApiCalls: state.successfulApiCalls || 0,
    failedApiCalls: state.failedApiCalls || 0,
    completedPagesCount,
    failedPagesCount,
    status: state.status,
    progressPercent: expectedTotalPages > 0 ? ((completedPagesCount / expectedTotalPages) * 100).toFixed(2) : '0.00',
    pagesFailed: state.pagesFailed || [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Lấy danh sách ID có phân trang và bộ lọc
 */
async function getPaginatedIDs(options = {}) {
  await connectDB();

  const page = parseInt(options.page || '1', 10);
  const limit = parseInt(options.limit || '100', 10);
  const search = (options.search || '').trim();

  const query = {};
  if (search && !isNaN(search)) {
    query.sourceId = Number(search);
  }

  const totalItems = await RawAuctionId.countDocuments(query);
  const totalPages = Math.ceil(totalItems / limit) || 1;

  const items = await RawAuctionId.find(query)
    .sort({ pageNumber: 1, sourceId: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    page,
    limit,
    totalItems,
    totalPages,
    items,
  };
}

/**
 * Xuất file báo cáo html tĩnh công khai
 */
async function generateHTMLReport() {
  await connectDB();
  const stats = await getAuditStats();
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const reportPath = path.join(publicDir, 'report_summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2), 'utf-8');
  console.log(`📊 Đã cập nhật file dữ liệu báo cáo: ${reportPath}`);
}

module.exports = {
  getAuditStats,
  getPaginatedIDs,
  generateHTMLReport,
};
