const fs = require('fs');
const path = 'd:/web-thong-ke-dau-gia/bot-crawls-data/src/api/routes.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/type: 'single_duplicate_scan'/g, "type: 'duplicate_scan'");
fs.writeFileSync(path, content, 'utf8');
console.log('Replaced successfully');
