const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const helpers = require('../src/utils/helpers');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const startId = 572451;
  const startNotice = await AuctionNotice.findOne({ sourceId: startId }).lean();
  if (!startNotice) {
    console.log(`Notice ${startId} not found!`);
    await mongoose.connection.close();
    return;
  }

  const rootId = startNotice.rootId;
  console.log(`Notice ${startId} has rootId: ${rootId}`);

  if (!rootId) {
    console.log(`Notice ${startId} has no rootId!`);
    await mongoose.connection.close();
    return;
  }

  const notices = await AuctionNotice.find({ rootId: rootId }).lean();
  const nMap = new Map(notices.map(n => [n.sourceId, n]));
  const nodes = notices.map(n => n.sourceId);

  console.log(`Analyzing connections among ${nodes.length} nodes: ${nodes.join(', ')}`);

  const directMatches = [];

  // 1. Check relatedIds connections
  for (const n of notices) {
    if (n.relatedIds) {
      for (const rid of n.relatedIds) {
        if (nMap.has(rid)) {
          directMatches.push({
            from: n.sourceId,
            to: rid,
            type: 'relatedIds',
            detail: `relatedId`
          });
        }
      }
    }
  }

  // 2. Check name-based matches
  const data = notices.map((n, i) => {
    return {
      index: i,
      sourceId: n.sourceId,
      name: n.name,
      isGeneric: helpers.isGenericTitle(n.name),
      coreBigrams: helpers.getBigrams(helpers.extractCoreIdentity(n.name)),
      numbers: helpers.getNumberTokens(n.name),
      identifiers: helpers.extractPropertyIdentifiers(n.name)
    };
  });

  for (let i = 0; i < data.length; i++) {
    const itemA = data[i];
    for (let j = i + 1; j < data.length; j++) {
      const itemB = data[j];

      // Check conflicts
      const conflict = helpers.hasConflictingIdentifiers(itemA.identifiers, itemB.identifiers);
      if (conflict) continue;

      // Strong match
      const strongMatch = helpers.hasMatchingStrongIdentifiers(itemA.identifiers, itemB.identifiers);
      if (strongMatch) {
        directMatches.push({
          from: itemA.sourceId,
          to: itemB.sourceId,
          type: 'strong_identifiers',
          detail: `Strong match`
        });
        continue;
      }

      // If generic, skip name similarity
      if (itemA.isGeneric || itemB.isGeneric) continue;

      const coreSim = helpers.jaccardSimilarity(itemA.coreBigrams, itemB.coreBigrams);
      const maxSizeB = itemA.coreBigrams.size / 0.80;
      const minSizeB = itemA.coreBigrams.size * 0.80;
      const sizeB = itemB.coreBigrams.size;

      // Rule 3: Jaccard >= 0.80
      if (coreSim >= 0.80 && sizeB >= minSizeB && sizeB <= maxSizeB) {
        directMatches.push({
          from: itemA.sourceId,
          to: itemB.sourceId,
          type: 'name_jaccard_0.80',
          detail: `Jaccard: ${coreSim}`
        });
        continue;
      }

      // Rule 4 & 5
      const bothHaveNumbers = itemA.numbers.length > 0 && itemB.numbers.length > 0;
      if (bothHaveNumbers) {
        const commonNumbers = itemA.numbers.filter(t => itemB.numbers.includes(t));
        if (commonNumbers.length > 0) {
          if (coreSim >= 0.55) {
            directMatches.push({
              from: itemA.sourceId,
              to: itemB.sourceId,
              type: 'name_jaccard_0.55_common_num',
              detail: `Jaccard: ${coreSim}, common: ${commonNumbers.join(', ')}`
            });
            continue;
          }
          const overlapSim = helpers.overlapSimilarity(itemA.coreBigrams, itemB.coreBigrams);
          if (overlapSim >= 0.85) {
            directMatches.push({
              from: itemA.sourceId,
              to: itemB.sourceId,
              type: 'name_overlap_0.85_common_num',
              detail: `Overlap: ${overlapSim}, common: ${commonNumbers.join(', ')}`
            });
            continue;
          }
        }
      }
    }
  }

  console.log('\n--- Direct Connections Found ---');
  for (const m of directMatches) {
    console.log(`[${m.type}] ${m.from} <-> ${m.to} (${m.detail || ''})`);
  }

  // Find paths using DFS
  const adj = {};
  for (const n of nodes) adj[n] = [];
  for (const m of directMatches) {
    adj[m.from].push({ to: m.to, type: m.type });
    adj[m.to].push({ to: m.from, type: m.type });
  }

  function findPath(curr, target, visited, path) {
    if (curr === target) return path;
    visited.add(curr);
    for (const neighbor of adj[curr]) {
      if (!visited.has(neighbor.to)) {
        const result = findPath(neighbor.to, target, visited, [...path, { to: neighbor.to, type: neighbor.type }]);
        if (result) return result;
      }
    }
    return null;
  }

  const targets = [572311, 572310, 560931, 403446];
  for (const tgt of targets) {
    console.log(`\n--- Path from ${startId} to ${tgt} ---`);
    if (!nMap.has(tgt)) {
      console.log(`Target ${tgt} is not in the same duplicate group!`);
      continue;
    }
    const path = findPath(startId, tgt, new Set(), []);
    if (path) {
      console.log(`Start: ${startId}`);
      for (const step of path) {
        console.log(`  --(${step.type})--> ${step.to}`);
      }
    } else {
      console.log(`No path found!`);
    }
  }

  await mongoose.connection.close();
}

run().catch(console.error);
