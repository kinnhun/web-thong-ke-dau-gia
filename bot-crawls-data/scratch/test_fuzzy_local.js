const { MongoClient } = require('mongodb');
const helpers = require('../src/utils/helpers');

const { extractCoreIdentity, getBigrams, getNumberTokens, extractPropertyIdentifiers, hasConflictingIdentifiers, hasMatchingStrongIdentifiers, jaccardSimilarity, overlapSimilarity, normalizeProvince, isSignificantNumber, isGenericTitle } = helpers;

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  const ids = [531787, 532768, 471423, 469765, 349164];
  const items = await db.collection('auctionnotices')
    .find({ sourceId: { $in: ids } })
    .toArray();

  console.log(`Loaded ${items.length} items.`);

  // Build commune-to-district map dynamically
  const communeToDistrictMap = {};
  for (const item of items) {
    item.ids = extractPropertyIdentifiers(item.address || item.name);
    const prov = normalizeProvince(item.province) || 'unknown';
    if (prov !== 'unknown' && item.ids.district && item.ids.commune) {
      if (!communeToDistrictMap[prov]) communeToDistrictMap[prov] = {};
      communeToDistrictMap[prov][item.ids.commune.toLowerCase().trim()] = item.ids.district.toLowerCase().trim();
    }
  }

  const buckets = {};
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const prov = normalizeProvince(item.province) || 'unknown';
    const ids = item.ids;
    let dist = ids.district ? ids.district.toLowerCase().trim() : 'unknown';
    const comm = ids.commune ? ids.commune.toLowerCase().trim() : '';

    if (dist === 'unknown' && comm && communeToDistrictMap[prov] && communeToDistrictMap[prov][comm]) {
      dist = communeToDistrictMap[prov][comm];
    }

    const bucketKey = prov;
    if (!buckets[bucketKey]) buckets[bucketKey] = {};
    const normalizedName = item.name ? item.name.normalize('NFC').normalize('NFD') : '';
    const cleanName = normalizedName.toLowerCase().replace(/[,\.\(\):\-]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const isGeneric = isGenericTitle(item.name);
    const bucketNameKey = isGeneric ? `${cleanName}_${idx}` : cleanName;

    if (!buckets[bucketKey][bucketNameKey]) {
      buckets[bucketKey][bucketNameKey] = { name: item.name, sourceIds: [] };
    }
    buckets[bucketKey][bucketNameKey].sourceIds.push(item.sourceId);
  }

  const allFuzzyGroups = [];
  const bucketKeys = Object.keys(buckets);

  for (const bucketKey of bucketKeys) {
    const cleanNames = Object.keys(buckets[bucketKey]);
    console.log(`\nProvince Bucket: ${bucketKey}`);
    console.log(`Clean Names:`, cleanNames);

    const data = cleanNames.map((cleanName, i) => {
      const originalName = buckets[bucketKey][cleanName].name;
      return {
        index: i,
        name: originalName,
        isGeneric: isGenericTitle(originalName),
        coreBigrams: getBigrams(extractCoreIdentity(originalName)),
        numbers: getNumberTokens(originalName),
        identifiers: extractPropertyIdentifiers(originalName),
        sourceIds: buckets[bucketKey][cleanName].sourceIds
      };
    });

    data.sort((a, b) => a.coreBigrams.size - b.coreBigrams.size);
    const parent = Array.from({ length: data.length }, (_, i) => i);
    const find = (i) => {
      if (parent[i] === i) return i;
      return parent[i] = find(parent[i]);
    };
    const members = Array.from({ length: data.length }, (_, i) => [i]);
    const union = (i, j) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        // Kiểm tra mâu thuẫn định danh giữa mọi phần tử của 2 tập hợp trước khi gộp
        for (const idxI of members[rootI]) {
          for (const idxJ of members[rootJ]) {
            if (hasConflictingIdentifiers(data[idxI].identifiers, data[idxJ].identifiers)) {
              console.log(`Conflict between:\n  A: ${data[idxI].name}\n  B: ${data[idxJ].name}`);
              return false;
            }
          }
        }
        parent[rootI] = rootJ;
        members[rootJ] = members[rootJ].concat(members[rootI]);
        members[rootI] = []; // Clear to save memory
        console.log(`SUCCESS union: ${i} and ${j}`);
        return true;
      }
      return true;
    };

    // PRE-PASS: Group by strong identifiers
    console.log('Running PRE-PASS strong keys...');
    const strongKeys = ['licensePlate', 'chassisNumber', 'engineNumber', 'certificateNumber', 'certificateEntryNumber', 'shipNumber', 'streetAddress', 'taxCode', 'contractNumber', 'stockAmount'];
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

    console.log('Strong Map:', strongMap);

    for (const [hash, indices] of strongMap.entries()) {
      if (indices.length > 1) {
        console.log(`Pre-pass grouping for ${hash}:`, indices);
        for (let k = 0; k < indices.length; k++) {
          for (let m = k + 1; m < indices.length; m++) {
            union(indices[k], indices[m]);
          }
        }
      }
    }

    console.log('\nFinal parent representation after PRE-PASS:');
    data.forEach((d, i) => {
      console.log(`Index ${i} (IDs: ${d.sourceIds}) -> Parent: ${find(i)}`);
    });
  }

  client.close();
}

run().catch(console.error);
