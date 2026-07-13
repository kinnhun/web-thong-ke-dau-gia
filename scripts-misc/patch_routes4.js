const fs = require('fs');
const file = 'bot-crawls-data/src/api/routes.js';
let content = fs.readFileSync(file, 'utf8');

const target = `        if (type === 'auction') {
          const exactNameRelatedIds = await searchDuplicatesByFuzzyName(sourceId, updates.name || item.name, 'auction');
          const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];
          if (allRelatedIds.length > 0) {
            console.log(\`[RECRAWL BG] Bắt đầu quét duplicate cho \${allRelatedIds.length} items...\`);
            const relatedDetailStats = await recrawlMissingAuctionDetails([sourceId, ...allRelatedIds], { concurrency: 3 });`;

const replacement = `        if (type === 'auction') {
          const Duplicate = require('../models/Duplicate');
          const existingDup = await Duplicate.findOne({ sourceIds: sourceId, type: 'auction' });
          const duplicateIds = existingDup ? existingDup.sourceIds : [];
          const exactNameRelatedIds = await searchDuplicatesByFuzzyName(sourceId, updates.name || item.name, 'auction');
          const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...(item.relatedIds || []), ...duplicateIds, ...exactNameRelatedIds])];
          if (allRelatedIds.length > 0) {
            console.log(\`[RECRAWL BG] Bắt đầu quét duplicate cho \${allRelatedIds.length} items...\`);
            const relatedDetailStats = await recrawlMissingAuctionDetails([sourceId, ...allRelatedIds], { concurrency: 3 });`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Success 1');
} else {
  console.log('Target not found, doing exact substring...');
  content = content.replace(
    "const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];",
    "const Duplicate = require('../models/Duplicate'); const existingDup = await Duplicate.findOne({ sourceIds: sourceId, type: 'auction' }); const duplicateIds = existingDup ? existingDup.sourceIds : []; const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...(item.relatedIds || []), ...duplicateIds, ...exactNameRelatedIds])];"
  );
  fs.writeFileSync(file, content);
  console.log('Success 2');
}
