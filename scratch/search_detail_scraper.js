const fs = require('fs');
const content = fs.readFileSync('bot-crawls-data/src/scrapers/detail.scraper.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('initialPrice')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
