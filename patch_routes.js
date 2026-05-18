const fs = require('fs');
const file = 'bot-crawls-data/src/api/routes.js';
let content = fs.readFileSync(file, 'utf8');

const target = `        if (type === 'auction' && updates.relatedIds && updates.relatedIds.length > 0) {
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
  console.log('Target not found, falling back to substring search');
  const lines = content.split('\n');
  for (let i=0; i<lines.length; i++) {
    if (lines[i].includes(`if (type === 'auction' && updates.relatedIds && updates.relatedIds.length > 0) {`)) {
       lines[i] = `        if (type === 'auction') {
          const Duplicate = require('../models/Duplicate');
          const existingDup = await Duplicate.findOne({ sourceIds: sourceId, type: 'auction' });
          const idsToHandle = existingDup ? existingDup.sourceIds : (updates.relatedIds || item.relatedIds || []);
          if (idsToHandle && idsToHandle.length > 0) {`;
    }
  }
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Fallback applied');
}
