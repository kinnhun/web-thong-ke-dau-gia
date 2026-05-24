const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../bot-crawls-data/src/scrapers/detail.scraper.js');
const lines = fs.readFileSync(file, 'utf8').split('\n');

console.log(`Total lines: ${lines.length}`);
lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  if (/handleDuplicate|searchDuplicatesByFuzzyName|Duplicate|dedup/i.test(line)) {
    console.log(`${lineNum}: ${line.trim()}`);
  }
});
