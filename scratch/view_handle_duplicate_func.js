const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../bot-crawls-data/src/scrapers/detail.scraper.js');
const lines = fs.readFileSync(file, 'utf8').split('\n');

function printFunction(name) {
  let start = -1;
  let braces = 0;
  let inFunc = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`async function ${name}`) || lines[i].includes(`function ${name}`)) {
      start = i;
      inFunc = true;
    }
    if (inFunc) {
      const line = lines[i];
      // count braces
      for (const char of line) {
        if (char === '{') braces++;
        if (char === '}') braces--;
      }
      console.log(`${i + 1}: ${line}`);
      if (braces === 0 && i > start) {
        break;
      }
    }
  }
}

printFunction('handleDuplicate');
