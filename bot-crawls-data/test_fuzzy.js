const mongoose = require('mongoose');
const AuctionNotice = require('./src/models/AuctionNotice');
const helpers = require('./src/utils/helpers');

async function getFuzzyNameGroupsFiltered(items) {
  const buckets = {};
  for (const item of items) {
    const prov = item.province || 'unknown';
    if (!buckets[prov]) buckets[prov] = {};
    const cleanName = item.name.toLowerCase().replace(/[,\.\(\):\-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!buckets[prov][cleanName]) buckets[prov][cleanName] = [];
    buckets[prov][cleanName].push(item.sourceId);
  }

  const allFuzzyGroups = [];
  const provKeys = Object.keys(buckets);
  for (const prov of provKeys) {
    const cleanNames = Object.keys(buckets[prov]);
    if (cleanNames.length === 0) continue;

    const data = cleanNames.map((name, i) => ({
      index: i,
      coreBigrams: helpers.getBigrams(helpers.extractCoreIdentity(name)),
      numbers: helpers.getNumberTokens(name),
      identifiers: helpers.extractPropertyIdentifiers(name),
      sourceIds: buckets[prov][name]
    }));

    data.sort((a, b) => a.coreBigrams.size - b.coreBigrams.size);
    const parent = Array.from({ length: data.length }, (_, i) => i);
    const find = (i) => {
      if (parent[i] === i) return i;
      return parent[i] = find(parent[i]);
    };
    const union = (i, j) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    };

    for (let i = 0; i < data.length; i++) {
      const sizeA = data[i].coreBigrams.size;
      if (sizeA === 0) continue;
      const maxSizeB = sizeA / 0.60;
      for (let j = i + 1; j < data.length; j++) {
        const sizeB = data[j].coreBigrams.size;
        if (sizeB === 0) continue;
        if (sizeB > maxSizeB) break;
        if (helpers.hasConflictingIdentifiers(data[i].identifiers, data[j].identifiers)) continue;
        if (helpers.hasMatchingStrongIdentifiers(data[i].identifiers, data[j].identifiers)) {
          union(i, j);
          continue;
        }
        const bothHaveNumbers = data[i].numbers.length > 0 && data[j].numbers.length > 0;
        if (bothHaveNumbers) {
          const common = data[i].numbers.filter(t => data[j].numbers.includes(t));
          if (common.length === 0) continue;
        }
        const coreSim = helpers.jaccardSimilarity(data[i].coreBigrams, data[j].coreBigrams);
        if (coreSim >= 0.80) {
          union(i, j);
        } else if (bothHaveNumbers && coreSim >= 0.60) {
          const common = data[i].numbers.filter(t => data[j].numbers.includes(t));
          if (common.length > 0) union(i, j);
        }
      }
    }

    const provGroups = {};
    for (let i = 0; i < data.length; i++) {
      const root = find(i);
      if (!provGroups[root]) provGroups[root] = [];
      provGroups[root].push(...data[i].sourceIds);
    }
    for (const root in provGroups) {
      const ids = [...new Set(provGroups[root])];
      if (ids.length >= 2) allFuzzyGroups.push({ ids: ids });
    }
  }
  return allFuzzyGroups;
}

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  const organizerRegex = new RegExp("Trung tâm Dịch vụ bán đấu giá tài sản TPHCM", 'i');
  const auctions = await AuctionNotice.find({ organizer: organizerRegex })
    .select('sourceId name province')
    .lean();
  
  console.log(`Found ${auctions.length} auctions for organizer.`);
  const targetIds = [564520, 446524, 484804];
  const filtered = auctions.filter(a => targetIds.includes(a.sourceId));
  console.log(`Of the target IDs, found in DB:`, filtered.map(a => a.sourceId));

  const groups = await getFuzzyNameGroupsFiltered(auctions);
  const targetGroup = groups.find(g => g.ids.some(id => targetIds.includes(id)));
  
  if (targetGroup) {
    console.log("Target group found:", targetGroup.ids);
  } else {
    console.log("Target group NOT found in getFuzzyNameGroupsFiltered output!");
  }
  process.exit(0);
}

test();
