const fs = require('fs');
const path = 'bot-crawls-data/src/scrapers/detail.scraper.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/        if \(sizeB > maxSizeB\) continue;\r?\n        \}\r?\n\r?\n        if \(hasConflictingIdentifiers/g, '        if (sizeB > maxSizeB) continue;\n\n        if (hasConflictingIdentifiers');
fs.writeFileSync(path, content);
console.log('Fixed syntax error');
