const fs = require('fs');
const path = 'bot-crawls-data/src/scrapers/detail.scraper.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Apply NFC normalization to getFuzzyNameGroups
const targetStr = "const cleanName = item.name.toLowerCase().replace(/[,\\.\\(\\):\\-]/g, ' ').replace(/\\s+/g, ' ').trim();";
const nfcReplacement = `const normalizedName = item.name ? item.name.normalize('NFC').normalize('NFD') : '';
    const cleanName = normalizedName.toLowerCase().replace(/[,\\.\\(\\):\\-]/g, ' ').replace(/\\s+/g, ' ').trim();`;

content = content.replace(targetStr, nfcReplacement);

// 2. Fix the PRE-PASS loop in both functions
const prePassTarget = `    for (const indices of strongMap.values()) {
      if (indices.length > 1) {
        for (let k = 1; k < indices.length; k++) {
          if (!hasConflictingIdentifiers(data[indices[0]].identifiers, data[indices[k]].identifiers)) {
            union(indices[0], indices[k]);
          }
        }
      }
    }`;

const prePassReplacement = `    for (const indices of strongMap.values()) {
      if (indices.length > 1) {
        for (let k = 0; k < indices.length; k++) {
          for (let m = k + 1; m < indices.length; m++) {
            if (!hasConflictingIdentifiers(data[indices[k]].identifiers, data[indices[m]].identifiers)) {
              union(indices[k], indices[m]);
            }
          }
        }
      }
    }`;

content = content.split(prePassTarget).join(prePassReplacement);

fs.writeFileSync(path, content);
console.log('Applied detailed fixes');
