const fs = require('fs');
const path = 'd:/web-thong-ke-dau-gia/bot-crawls-data/src/api/routes.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/if \(type === 'auction'\)/g, "if (type !== 'org')");
content = content.replace(/Tính năng quét trùng lặp đơn lẻ chỉ mới hỗ trợ cho loại 'auction'./g, "Tính năng quét trùng lặp đơn lẻ chưa hỗ trợ cho loại 'org'.");
fs.writeFileSync(path, content, 'utf8');
console.log('Replaced successfully');
