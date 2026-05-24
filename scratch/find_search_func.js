const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../bot-crawls-data/src/api/routes.js');
const lines = fs.readFileSync(file, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('/trigger-')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
