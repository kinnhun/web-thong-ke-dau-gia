const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const apiLogFile = path.join(logsDir, 'api_calls.log');
const errorLogFile = path.join(logsDir, 'api_errors.log');

function timeNow() {
  return new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/**
 * Ghi log cho từng lần gọi API
 * @param {Object} info
 * @param {number} info.pageNumber - Số trang
 * @param {string} info.url - URL gọi API
 * @param {number} [info.attempt=1] - Lần thử
 * @param {boolean} info.success - Thành công hay thất bại
 * @param {number} [info.statusCode=200] - Mã HTTP
 * @param {number} [info.itemCount=0] - Số lượng items lấy được
 * @param {number} [info.durationMs=0] - Thời gian phản hồi (ms)
 * @param {string} [info.error=''] - Thông báo lỗi nếu có
 */
function logApiCall(info) {
  const statusStr = info.success ? 'SUCCESS' : 'FAILED';
  const logLine = `[${timeNow()}] [${statusStr}] Page: ${info.pageNumber} | Attempt: ${info.attempt || 1} | HTTP ${info.statusCode || 200} | Items: ${info.itemCount || 0} | Duration: ${info.durationMs || 0}ms | URL: ${info.url}${info.error ? ` | Error: ${info.error}` : ''}\n`;

  // Ghi vào file log tổng
  fs.appendFileSync(apiLogFile, logLine, 'utf-8');

  // Nếu có lỗi, ghi vào file error log riêng
  if (!info.success || info.error) {
    fs.appendFileSync(errorLogFile, logLine, 'utf-8');
  }

  // In ra console
  if (info.success) {
    console.log(`📡 [API Call] P${info.pageNumber} | Lần ${info.attempt || 1} | HTTP ${info.statusCode || 200} | ${info.itemCount} items | ${info.durationMs}ms`);
  } else {
    console.error(`❌ [API Error] P${info.pageNumber} | Lần ${info.attempt || 1} | HTTP ${info.statusCode || 'ERR'} | Lỗi: ${info.error} | ${info.durationMs}ms`);
  }
}

module.exports = { logApiCall, apiLogFile, errorLogFile };
