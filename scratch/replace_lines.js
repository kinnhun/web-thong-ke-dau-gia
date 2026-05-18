const fs = require('fs');
const path = 'bot-crawls-data/src/scrapers/detail.scraper.js';
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const startIdx = 1957; // 0-based for line 1958
const endIdx = 2005; // 0-based for line 2006 (not inclusive)

const replacement = `    // PRE-PASS: Group by strong identifiers to avoid missing matches with different lengths
    const strongKeys = ['licensePlate', 'chassisNumber', 'engineNumber', 'certificateNumber', 'certificateEntryNumber', 'shipNumber', 'streetAddress', 'taxCode', 'contractNumber', 'ownerName', 'stockAmount', 'serialNumber', 'debtorName'];
    const strongMap = new Map();
    for (let i = 0; i < data.length; i++) {
      const ids = data[i].identifiers;
      for (const key of strongKeys) {
        if (ids[key]) {
          const hash = key + ':' + ids[key];
          if (!strongMap.has(hash)) strongMap.set(hash, []);
          strongMap.get(hash).push(i);
        }
      }
      if (ids.plotNumber && ids.mapSheet) {
        const hash = 'land:' + ids.plotNumber + ':' + ids.mapSheet;
        if (!strongMap.has(hash)) strongMap.set(hash, []);
        strongMap.get(hash).push(i);
      }
    }
    for (const indices of strongMap.values()) {
      if (indices.length > 1) {
        for (let k = 1; k < indices.length; k++) {
          if (!hasConflictingIdentifiers(data[indices[0]].identifiers, data[indices[k]].identifiers)) {
            union(indices[0], indices[k]);
          }
        }
      }
    }

    let lastYield = Date.now();
    for (let i = 0; i < data.length; i++) {
      // Yield to event loop if outer loop takes too long
      if (Date.now() - lastYield > 20) {
        await new Promise(r => setImmediate(r));
        lastYield = Date.now();
      }

      const sizeA = data[i].coreBigrams.size;
      if (sizeA === 0) continue;
      const maxSizeB = sizeA / 0.60;

      for (let j = i + 1; j < data.length; j++) {
        if (j % 500 === 0 && Date.now() - lastYield > 20) {
          await new Promise(resolve => setImmediate(resolve));
          lastYield = Date.now();
        }
        
        const sizeB = data[j].coreBigrams.size;
        if (sizeB === 0) continue;
        
        // BREAK EARLY! Since data is sorted by size, all remaining sizeB will be > maxSizeB
        if (sizeB > maxSizeB) break;

        if (hasConflictingIdentifiers(data[i].identifiers, data[j].identifiers)) {
          continue;
        }

        const bothHaveNumbers = data[i].numbers.length > 0 && data[j].numbers.length > 0;
        if (bothHaveNumbers) {
          const common = data[i].numbers.filter(t => data[j].numbers.includes(t));
          if (common.length === 0) continue; 
        }

        const coreSim = jaccardSimilarity(data[i].coreBigrams, data[j].coreBigrams);

        if (coreSim >= 0.80) {
          union(i, j);
        } else if (bothHaveNumbers && coreSim >= 0.60) {
          const common = data[i].numbers.filter(t => data[j].numbers.includes(t));
          if (common.length > 0) union(i, j);
        }
      }
    }`;

lines.splice(startIdx, endIdx - startIdx, replacement);
fs.writeFileSync(path, lines.join('\n'));
console.log('Replaced by line numbers successfully');
