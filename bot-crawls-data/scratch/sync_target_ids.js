const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');
const PotentialDuplicate = require('../src/models/PotentialDuplicate');

const {
  buildDuplicateBulkOperations,
  fetchDuplicateSourceMap,
  rebuildAllDuplicateEntries,
  buildGraphGroups,
  mergeDuplicateGroups
} = require('../src/scrapers/detail.scraper');
const { scoreAssetPair, generateBlockingKeys, normalizeProvince } = require('../src/utils/helpers');

async function getFuzzyNameGroupsLocal(targetSourceIds) {
  const type = 'auction';
  const targetSet = new Set(targetSourceIds);
  const provinces = ['TP. Hồ Chí Minh'];
  const allFuzzyGroups = [];
  let potentialDupOps = [];

  for (let pIdx = 0; pIdx < provinces.length; pIdx++) {
    const prov = provinces[pIdx];
    const query = { sourceType: type, province: prov };
    const items = await AssetItem.find(query).lean();
    if (items.length < 2) continue;

    console.log(`Processing local fuzzy groups for HCMC: ${items.length} items`);

    const blockingMap = new Map();
    items.forEach((item, idx) => {
      item.index = idx;
      if (Array.isArray(item.blockingKeys)) {
        if (item.blockingKeys.length > 0) {
          item.blockingKeys.forEach(key => {
            if (!blockingMap.has(key)) blockingMap.set(key, []);
            blockingMap.get(key).push(item);
          });
        }
      }
    });

    const parent = {};
    items.forEach(item => {
      parent[item._id.toString()] = item._id.toString();
    });

    const find = (id) => {
      if (parent[id] === id) return id;
      return parent[id] = find(parent[id]);
    };

    const union = (id1, id2) => {
      const r1 = find(id1);
      const r2 = find(id2);
      if (r1 !== r2) {
        parent[r1] = r2;
      }
    };

    for (let i = 0; i < items.length; i++) {
      const itemA = items[i];
      const idAStr = itemA._id.toString();
      const hasTargetA = targetSet.has(itemA.sourceId);

      const candidates = new Set();
      if (Array.isArray(itemA.blockingKeys)) {
        itemA.blockingKeys.forEach(key => {
          const list = blockingMap.get(key);
          if (list) {
            list.forEach(candidate => {
              if (candidate._id.toString() !== idAStr) {
                candidates.add(candidate);
              }
            });
          }
        });
      }

      for (const itemB of candidates) {
        if (itemB.index <= i) continue;

        const idBStr = itemB._id.toString();
        const hasTargetB = targetSet.has(itemB.sourceId);

        if (!hasTargetA && !hasTargetB) continue;

        const scoreRes = scoreAssetPair(itemA, itemB);
        if (scoreRes.decision === 'auto_group') {
          union(idAStr, idBStr);
        }
      }
    }

    const groupsMap = {};
    items.forEach(item => {
      const root = find(item._id.toString());
      if (!groupsMap[root]) groupsMap[root] = [];
      groupsMap[root].push(item.sourceId);
    });

    for (const root in groupsMap) {
      const ids = [...new Set(groupsMap[root])];
      if (ids.length >= 2) {
        // filter groups that actually contain at least one of our targetSourceIds
        const hasTarget = ids.some(id => targetSet.has(id));
        if (hasTarget) {
          allFuzzyGroups.push({ ids });
        }
      }
    }
  }

  return allFuzzyGroups;
}

async function run() {
  await connectDB();

  const targetSourceIds = [454852, 471403, 561763];
  console.log('Target Source IDs:', targetSourceIds);

  // 1. Sync AssetItems for the target source IDs first to make sure they are up-to-date
  const notices = await AuctionNotice.find({ sourceId: { $in: targetSourceIds } }).lean();
  console.log(`Found ${notices.length} notices.`);

  const { extractPropertyIdentifiers } = require('../src/utils/helpers');
  function mapAssetType(propertyTypeName = '', propertyName = '') {
    const combined = `${propertyTypeName} ${propertyName}`.toLowerCase();
    if (combined.includes('quyền sử dụng đất') || combined.includes('đất đai')) return 'land';
    if (combined.includes('nhà ở') || combined.includes('căn hộ') || combined.includes('chung cư')) return 'house';
    if (combined.includes('phương tiện') || combined.includes('ô tô') || combined.includes('xe')) return 'car';
    if (combined.includes('máy móc') || combined.includes('thiết bị') || combined.includes('dây chuyền')) return 'machinery';
    if (combined.includes('thi hành án')) return 'enforcement';
    return 'other';
  }

  // Clear existing AssetItems for these sourceIds and re-insert them
  await AssetItem.deleteMany({ sourceType: 'auction', sourceId: { $in: targetSourceIds } });
  
  const assetItemsToInsert = notices.map(n => {
    const ids = extractPropertyIdentifiers(n.name);
    const item = {
      noticeId: n._id,
      sourceType: 'auction',
      sourceId: n.sourceId,
      itemIndex: 0,
      name: n.name,
      assetType: mapAssetType(n.propertyTypeName, n.name),
      province: n.province,
      district: ids.district || n.district,
      ward: ids.commune,
      identifiers: ids,
      ownerName: ids.ownerName || n.owner,
      startingPrice: n.initialPrice,
      rawText: n.name,
      normalizedText: n.name.toLowerCase()
    };
    const { generateBlockingKeys } = require('../src/utils/helpers');
    item.blockingKeys = generateBlockingKeys(item);
    return item;
  });

  await AssetItem.insertMany(assetItemsToInsert);
  console.log(`Re-synced ${assetItemsToInsert.length} AssetItems into DB.`);

  // 2. Clear old duplicates for these target IDs
  console.log('Clearing old duplicates/potentials for target IDs...');
  await Duplicate.deleteMany({ sourceType: 'auction', sourceIds: { $in: targetSourceIds } });
  await PotentialDuplicate.deleteMany({
    $or: [
      { 'itemA.sourceId': { $in: targetSourceIds } },
      { 'itemB.sourceId': { $in: targetSourceIds } }
    ]
  });

  // 3. Find Fuzzy Groups
  console.log('Finding fuzzy groups...');
  const nameGroups = await getFuzzyNameGroupsLocal(targetSourceIds);
  console.log('Fuzzy groups returned:', JSON.stringify(nameGroups, null, 2));

  // 4. Process groups
  if (nameGroups.length > 0) {
    const auctions = await AuctionNotice.find({ sourceId: { $in: targetSourceIds } })
      .select('sourceId relatedIds name province address')
      .lean();

    const relatedGroups = await buildGraphGroups(auctions, (item) => item.relatedIds);
    const normalizedNameGroups = nameGroups
      .map((group) => Array.isArray(group.ids) ? [...new Set(group.ids)].sort((a, b) => a - b) : [])
      .filter((group) => group.length >= 2);

    const mergedGroups = mergeDuplicateGroups(relatedGroups, normalizedNameGroups);
    console.log('Merged groups:', mergedGroups);

    const allSourceIds = [...new Set(mergedGroups.flat())];
    if (allSourceIds.length > 0) {
      console.log('Fetching source map...');
      const sourceMap = await fetchDuplicateSourceMap('auction', allSourceIds);
      console.log('Building operations...');
      const operations = buildDuplicateBulkOperations(mergedGroups, sourceMap, 'auction');
      console.log(`Executing ${operations.length} bulk operations...`);
      await Duplicate.bulkWrite(operations, { ordered: false });
      console.log('Duplicates bulkWrite complete.');

      // 5. Rebuild Duplicate Entries (populates rootId, publishRound etc.)
      console.log('Rebuilding duplicate entries for notices...');
      await rebuildAllDuplicateEntries(() => false, console.log);
      console.log('Rebuilding duplicate entries complete.');
    }
  }

  await closeDB();
}

run().catch(console.error);
