const fs = require('fs');
const filepath = 'C:\\Users\\trant\\.gemini\\antigravity\\brain\\05d1e07c-a5c6-4bfd-b280-f5061196a0c1\\walkthrough_recrawl_missing_price.md';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/\n\s*!\[Nhật ký crawl cho tiến trình cào tin thiếu giá\].*$/m, '');
fs.writeFileSync(filepath, content, 'utf8');
console.log('Done!');
