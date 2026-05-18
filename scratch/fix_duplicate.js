const fs = require('fs');
const path = 'bot-crawls-data/src/scrapers/detail.scraper.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove duplicate line (find all matches just in case)
content = content.replace(/    if \(progressCallback\) await progressCallback\(`Đang so sánh fuzzy tỉnh \$\{prov\} \(\$\{pIdx \+ 1\}\/\$\{provKeys.length\}\) với \$\{data.length\} tên duy nhất\.\.\.`\);\r?\n\r?\n    \r?\n    let lastYield = Date.now\(\);/g, '    let lastYield = Date.now();');

// 2. Remove isLargeBucket logic
content = content.replace(/\s*\/\/\s*BƯỚC 0: Nếu bucket quá lớn, buộc phải có điểm chung tối thiểu để so sánh tiếp\r?\n\s*if \(isLargeBucket\) \{[\s\S]*?\}\r?\n/g, '\n');

fs.writeFileSync(path, content);
console.log('Fixed file.');
