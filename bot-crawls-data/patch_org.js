const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/api/routes.js');
let content = fs.readFileSync(p, 'utf8');

const orgScanCode = `      for (const item of notices) {
        if (cancelled) break;

        const relatedIds = await searchDuplicatesByFuzzyName(item.sourceId, item.name, item.type);
        if (relatedIds.length > 0) {
          await handleDuplicate(item.sourceId, item.name, relatedIds, item.type);
          totalUpdated += relatedIds.length;
        }`;

const orgScanFix = `      for (const item of notices) {
        if (cancelled) break;

        const relatedIds = await searchDuplicatesByFuzzyName(item.sourceId, item.name, item.type, true); // skipApiSearch = true
        if (relatedIds.length > 0) {
          await handleDuplicate(item.sourceId, item.name, relatedIds, item.type);
          totalUpdated += relatedIds.length;
        }`;

content = content.replace(orgScanCode, orgScanFix);
content = content.replace(orgScanCode.replace(/\r\n/g, '\n'), orgScanFix.replace(/\r\n/g, '\n'));

fs.writeFileSync(p, content, 'utf8');
console.log("Patched org scan loop!");
