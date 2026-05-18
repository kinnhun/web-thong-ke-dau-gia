const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/api/routes.js');
let content = fs.readFileSync(p, 'utf8');

const targetStr = `        if (type !== 'org') {
          const exactNameRelatedIds = await searchDuplicatesByFuzzyName(sourceId, item.name, 'auction');`;
const fixStr = `        if (type !== 'org') {
          const exactNameRelatedIds = await searchDuplicatesByFuzzyName(sourceId, item.name, 'auction', true);`;

content = content.replace(targetStr, fixStr);
content = content.replace(targetStr.replace(/\r\n/g, '\n'), fixStr.replace(/\r\n/g, '\n'));

fs.writeFileSync(p, content, 'utf8');
console.log("Patched single scan!");
