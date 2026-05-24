const fs = require('fs');
const content = fs.readFileSync('bot-crawls-data/src/api/routes.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('function buildTextSearchFilter')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
