const fs = require('fs');
const file = 'bot-crawls-data/src/api/routes.js';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const newLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('console.log(`[QUEUE] ✅ #${sourceId} hoàn thành')) {
    newLines.push('        }');
  }
  newLines.push(lines[i]);
}
fs.writeFileSync(file, newLines.join('\n'));
console.log('Fixed syntax error');
