const fs = require('fs');
const path = 'bot-crawls-data/src/scrapers/detail.scraper.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Apply NFC normalization to getFuzzyNameGroups
const nfcRegex = /    const cleanName = item\.name\.toLowerCase\(\)\.replace\(\/\[,\\.\\(\\\):\\-\]\/g, ' '\)\.replace\(\/\\s\+\/g, ' '\)\.trim\(\);\r?\n    if \(!buckets\[prov\]\[cleanName\]\)/;
const nfcReplacement = `    const normalizedName = item.name ? item.name.normalize('NFC').normalize('NFD') : '';
    const cleanName = normalizedName.toLowerCase().replace(/[,\\.\\(\\):\\-]/g, ' ').replace(/\\s+/g, ' ').trim();
    if (!buckets[prov][cleanName])`;

content = content.replace(nfcRegex, nfcReplacement);

// 2. Fix the PRE-PASS loop in both functions
const prePassRegex = /    for \(const indices of strongMap\.values\(\)\) \{\r?\n      if \(indices\.length > 1\) \{\r?\n        for \(let k = 1; k < indices\.length; k\+\+\) \{\r?\n          if \(!hasConflictingIdentifiers\(data\[indices\[0\]\]\.identifiers, data\[indices\[k\]\]\.identifiers\)\) \{\r?\n            union\(indices\[0\], indices\[k\]\);\r?\n          \}\r?\n        \}\r?\n      \}\r?\n    \}/g;

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

content = content.replace(prePassRegex, prePassReplacement);

fs.writeFileSync(path, content);
console.log('Applied detailed fixes');
