/**
 * Test v4: Phase 1 với sourceId overlap union + Phase 2 orphan merge
 * Mục tiêu: 100% chính xác cho TPHCM center
 */
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const OrgSelection = require('../src/models/OrgSelection');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

function buildKey(ids, district, ward) {
  return [`p:${ids.plotNumber}`, `s:${ids.mapSheet || '?'}`,
    `d:${(district || '?').toLowerCase().trim()}`,
    `w:${(ward || '?').toLowerCase().trim()}`].join('|');
}

async function crossMergeV4(type, log) {
  const Model = type === 'auction' ? AuctionNotice : OrgSelection;
  
  // PHASE 1: Merge existing Duplicate records
  log('Phase 1: Loading duplicates...');
  const duplicates = await Duplicate.find({ type }).lean();
  if (!duplicates.length) return;

  const allSourceIds = [...new Set(duplicates.flatMap(d => d.sourceIds))];
  const items = await AssetItem.find({ sourceId: { $in: allSourceIds }, sourceType: type })
    .select('sourceId identifiers district ward').lean();
  const notices = await Model.find({ sourceId: { $in: allSourceIds } })
    .select('sourceId organizer').lean();
  const orgMap = {};
  for (const n of notices) orgMap[n.sourceId] = n.organizer || '';

  const sourceIdKeys = {};
  for (const item of items) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const key = buildKey(ids, item.district, item.ward);
    if (!sourceIdKeys[item.sourceId]) sourceIdKeys[item.sourceId] = new Set();
    sourceIdKeys[item.sourceId].add(key);
  }

  const keyToDupIds = {};
  const sourceIdToDupIds = {};
  for (const dup of duplicates) {
    const orgs = dup.sourceIds.map(sid => orgMap[sid]).filter(Boolean);
    const mainOrg = orgs[0] || '';
    const orgSlug = mainOrg.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const sid of dup.sourceIds) {
      // Track sourceId → dupIds
      if (!sourceIdToDupIds[sid]) sourceIdToDupIds[sid] = new Set();
      sourceIdToDupIds[sid].add(dup._id.toString());

      const keys = sourceIdKeys[sid];
      if (!keys) continue;
      for (const key of keys) {
        const fullKey = `${key}|org:${orgSlug}`;
        if (!keyToDupIds[fullKey]) keyToDupIds[fullKey] = new Set();
        keyToDupIds[fullKey].add(dup._id.toString());
      }
    }
  }

  // Union-Find
  const parent = {};
  for (const d of duplicates) parent[d._id.toString()] = d._id.toString();
  const find = (id) => { if (parent[id] === id) return id; return parent[id] = find(parent[id]); };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb; };

  let mergeableKeys = 0;
  for (const [key, dupIdSet] of Object.entries(keyToDupIds)) {
    const dupIds = [...dupIdSet];
    if (dupIds.length < 2) continue;
    mergeableKeys++;
    for (let i = 1; i < dupIds.length; i++) union(dupIds[0], dupIds[i]);
  }

  // NEW: Union dups sharing sourceIds (batch notices)
  let sourceIdOverlaps = 0;
  for (const [sid, dupIdSet] of Object.entries(sourceIdToDupIds)) {
    const dupIds = [...dupIdSet];
    if (dupIds.length < 2) continue;
    sourceIdOverlaps++;
    for (let i = 1; i < dupIds.length; i++) union(dupIds[0], dupIds[i]);
  }

  log(`Phase 1: ${mergeableKeys} key merges, ${sourceIdOverlaps} sourceId overlaps`);

  if (mergeableKeys > 0 || sourceIdOverlaps > 0) {
    const groupsByRoot = {};
    for (const d of duplicates) {
      const root = find(d._id.toString());
      if (!groupsByRoot[root]) groupsByRoot[root] = [];
      groupsByRoot[root].push(d);
    }
    const toMerge = Object.values(groupsByRoot).filter(g => g.length > 1);
    log(`Phase 1: Merging ${toMerge.length} groups...`);

    const bulkOps = [];
    const idsToDelete = [];
    for (const group of toMerge) {
      const allIds = [...new Set(group.flatMap(d => d.sourceIds))].sort((a, b) => a - b);
      const keeper = group.reduce((best, d) => {
        return ((d.rootId || d.sourceIds[0]) < (best.rootId || best.sourceIds[0])) ? d : best;
      });
      const rootId = keeper.rootId || allIds[0];
      bulkOps.push({ updateOne: { filter: { _id: keeper._id }, update: { $set: { sourceIds: allIds, rootId } } } });
      for (const d of group) if (d._id.toString() !== keeper._id.toString()) idsToDelete.push(d._id);
    }
    if (bulkOps.length > 0) await Duplicate.bulkWrite(bulkOps, { ordered: false });
    if (idsToDelete.length > 0) await Duplicate.deleteMany({ _id: { $in: idsToDelete } });

    // Update rootId
    const updatedDups = await Duplicate.find({ type }).lean();
    const rootBulkOps = [];
    for (const dup of updatedDups) {
      if (!dup.rootId) continue;
      for (const sid of dup.sourceIds) {
        rootBulkOps.push({ updateOne: { filter: { sourceId: sid }, update: { $set: { rootId: dup.rootId } } } });
      }
    }
    for (let i = 0; i < rootBulkOps.length; i += 5000) {
      await Model.bulkWrite(rootBulkOps.slice(i, i + 5000), { ordered: false });
    }
    log(`Phase 1: Done. Merged ${toMerge.length}, deleted ${idsToDelete.length}`);
  }

  // PHASE 2: Orphan merge
  log('Phase 2: Finding orphan items...');
  const currentDups = await Duplicate.find({ type }).select('sourceIds rootId name').lean();
  const groupedSourceIds = new Set(currentDups.flatMap(d => d.sourceIds));

  const allItems = await AssetItem.find({ sourceType: type, 'identifiers.plotNumber': { $exists: true, $ne: null } })
    .select('sourceId identifiers district ward').lean();
  const orphanItems = allItems.filter(item => !groupedSourceIds.has(item.sourceId));
  log(`Phase 2: ${orphanItems.length} orphan items`);

  if (orphanItems.length === 0) return;

  const orphanSourceIds = [...new Set(orphanItems.map(i => i.sourceId))];
  const orphanNotices = await Model.find({ sourceId: { $in: orphanSourceIds } })
    .select('sourceId organizer name').lean();
  const orphanOrgMap = {};
  for (const n of orphanNotices) orphanOrgMap[n.sourceId] = { organizer: n.organizer || '', name: n.name || '' };

  const orphanKeyGroups = {};
  for (const item of orphanItems) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const org = orphanOrgMap[item.sourceId]?.organizer || '';
    const orgSlug = org.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
    const fullKey = `${buildKey(ids, item.district, item.ward)}|org:${orgSlug}`;
    if (!orphanKeyGroups[fullKey]) orphanKeyGroups[fullKey] = new Set();
    orphanKeyGroups[fullKey].add(item.sourceId);
  }

  // Build existing dup key map with Map for O(1)
  const groupedItems = allItems.filter(item => groupedSourceIds.has(item.sourceId));
  const itemsBySourceId = new Map();
  for (const item of groupedItems) {
    if (!itemsBySourceId.has(item.sourceId)) itemsBySourceId.set(item.sourceId, []);
    itemsBySourceId.get(item.sourceId).push(item);
  }
  const groupedNotices = await Model.find({ sourceId: { $in: [...groupedSourceIds].slice(0, 500000) } })
    .select('sourceId organizer').lean();
  const gOrgMap = {};
  for (const n of groupedNotices) gOrgMap[n.sourceId] = n.organizer || '';

  const existingDupKeyMap = {};
  for (const dup of currentDups) {
    const dupOrg = dup.sourceIds.map(sid => gOrgMap[sid]).filter(Boolean)[0] || '';
    const dupOrgSlug = dupOrg.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const sid of dup.sourceIds) {
      const mi = itemsBySourceId.get(sid);
      if (!mi) continue;
      for (const item of mi) {
        const ids = item.identifiers || {};
        if (!ids.plotNumber) continue;
        const fullKey = `${buildKey(ids, item.district, item.ward)}|org:${dupOrgSlug}`;
        if (!existingDupKeyMap[fullKey]) existingDupKeyMap[fullKey] = dup;
      }
    }
  }

  let created = 0, merged = 0;
  for (const [key, sourceIdSet] of Object.entries(orphanKeyGroups)) {
    const sids = [...sourceIdSet].sort((a, b) => a - b);
    if (sids.length < 2 && !existingDupKeyMap[key]) continue;
    const existing = existingDupKeyMap[key];
    if (existing) {
      const all = [...new Set([...existing.sourceIds, ...sids])].sort((a, b) => a - b);
      await Duplicate.updateOne({ _id: existing._id }, { $set: { sourceIds: all } });
      for (const sid of sids) await Model.updateOne({ sourceId: sid }, { $set: { rootId: existing.rootId } });
      merged++;
    } else if (sids.length >= 2) {
      await Duplicate.create({ type, name: orphanOrgMap[sids[0]]?.name || '', sourceIds: sids, rootId: sids[0], relistCount: sids.length, entries: [] });
      for (const sid of sids) await Model.updateOne({ sourceId: sid }, { $set: { rootId: sids[0] } });
      created++;
    }
  }
  log(`Phase 2: Created ${created}, merged ${merged}`);
}

async function auditTPHCM() {
  const orgName = /trung.*t[aâ]m.*d[iị]ch.*v[uụ].*b[aá]n.*đ[aấ]u.*gi[aá].*t[aà]i.*s[aả]n.*t(p|hcm|phcm)/i;
  const notices = await AuctionNotice.find({ organizer: orgName }).select('sourceId rootId').lean();
  const sourceIds = notices.map(n => n.sourceId);
  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' })
    .select('sourceId identifiers district ward').lean();

  let noRoot = 0;
  const byRoot = {};
  for (const n of notices) {
    if (n.rootId) { if (!byRoot[n.rootId]) byRoot[n.rootId] = []; byRoot[n.rootId].push(n); }
    else noRoot++;
  }

  const idGroups = {};
  for (const item of items) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const key = `plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${item.district || '?'}|w:${item.ward || '?'}`;
    if (!idGroups[key]) idGroups[key] = [];
    const n = notices.find(n => n.sourceId === item.sourceId);
    idGroups[key].push({ sourceId: item.sourceId, rootId: n?.rootId || null });
  }

  const multi = Object.entries(idGroups).filter(([k, v]) => v.length >= 2);
  let missed = 0;
  const missedList = [];
  for (const [key, group] of multi) {
    const roots = [...new Set(group.map(g => g.rootId || `solo_${g.sourceId}`))];
    if (roots.length > 1) { missed++; missedList.push({ key, count: group.length, roots: roots.length }); }
  }

  return {
    total: notices.length, grouped: notices.length - noRoot, noRoot,
    rootIds: Object.keys(byRoot).length, correct: multi.length - missed,
    missed, accuracy: ((multi.length - missed) / Math.max(multi.length, 1) * 100).toFixed(1),
    topMissed: missedList.sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

async function run() {
  await connectDB();
  const log = (msg) => console.log(`  ${msg}`);

  console.log('\n=== TRƯỚC ===');
  const before = await auditTPHCM();
  console.log(`Tổng: ${before.total} | rootId: ${before.grouped} | noRoot: ${before.noRoot}`);
  console.log(`Đúng: ${before.correct} | Lọt: ${before.missed} | Chính xác: ${before.accuracy}%`);
  for (const m of before.topMissed.slice(0, 5)) console.log(`  ${m.key}: ${m.count} tin, ${m.roots} rootId`);

  console.log('\n=== CROSS-MERGE V4 ===');
  await crossMergeV4('auction', log);

  console.log('\n=== SAU ===');
  const after = await auditTPHCM();
  console.log(`Tổng: ${after.total} | rootId: ${after.grouped} | noRoot: ${after.noRoot}`);
  console.log(`Đúng: ${after.correct} | Lọt: ${after.missed} | Chính xác: ${after.accuracy}%`);
  if (after.topMissed.length > 0) {
    console.log(`Vẫn lọt:`);
    for (const m of after.topMissed) console.log(`  ${m.key}: ${m.count} tin, ${m.roots} rootId`);
  }

  console.log('\n=== KẾT QUẢ ===');
  console.log(`Lọt: ${before.missed} → ${after.missed}`);
  console.log(`Chính xác: ${before.accuracy}% → ${after.accuracy}%`);
  console.log(`noRoot: ${before.noRoot} → ${after.noRoot}`);

  await closeDB();
}

run().catch(console.error);
