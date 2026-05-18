const fs = require('fs');
const file = 'bot-crawls-data/src/api/routes.js';
let content = fs.readFileSync(file, 'utf8');

const target = `        if (type === 'auction') {
          const Duplicate = require('../models/Duplicate');
          const existingDup = await Duplicate.findOne({ sourceIds: sourceId, type: 'auction' });
          const idsToHandle = existingDup ? existingDup.sourceIds : (updates.relatedIds || item.relatedIds || []);
          if (idsToHandle && idsToHandle.length > 0) {
          await handleDuplicate(sourceId, updates.name || item.name, updates.relatedIds, 'auction');
        }`;

const replacement = `        if (type === 'auction') {
          const Duplicate = require('../models/Duplicate');
          const existingDup = await Duplicate.findOne({ sourceIds: sourceId, type: 'auction' });
          const idsToHandle = existingDup ? existingDup.sourceIds : (updates.relatedIds || item.relatedIds || []);
          if (idsToHandle && idsToHandle.length > 0) {
            await handleDuplicate(sourceId, updates.name || item.name, idsToHandle, 'auction');
          }
        }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Success');
} else {
  console.log('Target not found again, doing precise substring replace...');
  content = content.replace("await handleDuplicate(sourceId, updates.name || item.name, updates.relatedIds, 'auction');", "await handleDuplicate(sourceId, updates.name || item.name, idsToHandle, 'auction');");
  fs.writeFileSync(file, content);
  console.log('Precise replace done');
}
