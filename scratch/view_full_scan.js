const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../bot-crawls-data/src/scrapers/detail.scraper.js');
const lines = fs.readFileSync(file, 'utf8').split('\n');

for (let i = 1400; i < 1730; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
