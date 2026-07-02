/**
 * Test script v2: Chạy Cross-Merge Phase 1 + Phase 2 trên dữ liệu hiện có
 * rồi audit lại TPHCM center.
 */
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const OrgSelection = require('../src/models/OrgSelection');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

async function mergeIdenticalAssetGroups(type, saveProgress, checkCancelled) {
  const label = type === 'auction' ? 'AuctionNotice' : 'OrgSelection';
  const Model = type === 'auction' ? AuctionNotice : OrgSelection;

  if (saveProgress) await saveProgress(`[Phase 1] Đang tải Duplicate records (${label})...`);
  const duplicates = await Duplicate.find({ type }).lean();
  if (duplicates.length === 0) return;

  if (saveProgress) await saveProgress(`[Phase 1] Đang phân tích ${duplicates.length} nhóm duplicate...`);

  const allSourceIds = [...new Set(duplicates.flatMap(d => d.sourceIds))];
  const items = await AssetItem.find({
    sourceId: { $in: allSourceIds }, sourceType: type
  }).select('sourceId identifiers district ward').lean();

  const notices = await Model.find({ sourceId: { $in: allSourceIds } })
    .select('sourceId organizer').lean();
  const orgMap = {};
  for (const n of notices) orgMap[n.sourceId] = n.organizer || '';

  const sourceIdKeys = {};
  for (const item of items) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const key = [`p:${ids.plotNumber}`, `s:${ids.mapSheet || '?'}`,
      `d:${(item.district || '?').toLowerCase().trim()}`,
      `w:${(item.ward || '?').toLowerCase().trim()}`].join('|');
    if (!sourceIdKeys[item.sourceId]) sourceIdKeys[item.sourceId] = new Set();
    sourceIdKeys[item.sourceId].add(key);
  }

  const keyToDupIds = {};
  for (const dup of duplicates) {
    const orgs = dup.sourceIds.map(sid => orgMap[sid]).filter(Boolean);
    const mainOrg = orgs[0] || '';
    for (const sid of dup.sourceIds) {
      const keys = sourceIdKeys[sid];
      if (!keys) continue;
      for (const key of keys) {
        const orgSlug = mainOrg.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
        const fullKey = `${key}|org:${orgSlug}`;
        if (!keyToDupIds[fullKey]) keyToDupIds[fullKey] = new Set();
        keyToDupIds[fullKey].add(dup._id.toString());
      }
    }
  }

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

  if (mergeableKeys > 0) {
    const groupsByRoot = {};
    for (const d of duplicates) {
      const root = find(d._id.toString());
      if (!groupsByRoot[root]) groupsByRoot[root] = [];
      groupsByRoot[root].push(d);
    }
    const toMerge = Object.values(groupsByRoot).filter(g => g.length > 1);

    if (saveProgress) await saveProgress(`[Phase 1] Đang merge ${toMerge.length} nhóm...`);

    let mergedCount = 0;
    const bulkOps = [];
    const idsToDelete = [];

    for (const group of toMerge) {
      const allIds = [...new Set(group.flatMap(d => d.sourceIds))].sort((a, b) => a - b);
      const keeper = group.reduce((best, d) => {
        const bestRoot = best.rootId || best.sourceIds[0];
        const dRoot = d.rootId || d.sourceIds[0];
        return (dRoot < bestRoot) ? d : best;
      });
      const keeperId = keeper._id.toString();
      const rootId = keeper.rootId || allIds[0];

      bulkOps.push({ updateOne: { filter: { _id: keeper._id }, update: { $set: { sourceIds: allIds, rootId, name: keeper.name } } } });
      for (const d of group) {
        if (d._id.toString() !== keeperId) idsToDelete.push(d._id);
      }
      mergedCount++;
    }

    if (bulkOps.length > 0) await Duplicate.bulkWrite(bulkOps, { ordered: false });
    if (idsToDelete.length > 0) await Duplicate.deleteMany({ _id: { $in: idsToDelete } });

    // Update rootId on notices
    const updatedDups = await Duplicate.find({ type }).lean();
    const rootBulkOps = [];
    for (const dup of updatedDups) {
      if (!dup.rootId) continue;
      for (const sid of dup.sourceIds) {
        rootBulkOps.push({ updateOne: { filter: { sourceId: sid }, update: { $set: { rootId: dup.rootId } } } });
      }
    }
    if (rootBulkOps.length > 0) {
      for (let i = 0; i < rootBulkOps.length; i += 5000) {
        await Model.bulkWrite(rootBulkOps.slice(i, i + 5000), { ordered: false });
      }
    }

    console.log(`[Phase 1] Merged ${mergedCount} groups, deleted ${idsToDelete.length} records`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: Orphan notices cùng identifier → tạo/merge Duplicate mới
  // ═══════════════════════════════════════════════════════════════════
  if (saveProgress) await saveProgress(`[Phase 2] Đang tìm tin đơn lẻ chưa gom nhóm...`);

  const currentDups = await Duplicate.find({ type }).select('sourceIds rootId name').lean();
  const groupedSourceIds = new Set(currentDups.flatMap(d => d.sourceIds));

  const allItems2 = await AssetItem.find({ sourceType: type })
    .select('sourceId identifiers district ward').lean();
  const orphanItems = allItems2.filter(item => !groupedSourceIds.has(item.sourceId));

  const allOrphanSourceIds = [...new Set(orphanItems.map(i => i.sourceId))];
  const orphanOrgMap = {};
  if (allOrphanSourceIds.length > 0) {
    const orphanNotices = await Model.find({ sourceId: { $in: allOrphanSourceIds } })
      .select('sourceId organizer name').lean();
    for (const n of orphanNotices) {
      orphanOrgMap[n.sourceId] = { organizer: n.organizer || '', name: n.name || '' };
    }
  }

  const orphanKeyGroups = {};
  for (const item of orphanItems) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const org = orphanOrgMap[item.sourceId]?.organizer || '';
    const orgSlug = org.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = [`p:${ids.plotNumber}`, `s:${ids.mapSheet || '?'}`,
      `d:${(item.district || '?').toLowerCase().trim()}`,
      `w:${(item.ward || '?').toLowerCase().trim()}`,
      `org:${orgSlug}`].join('|');
    if (!orphanKeyGroups[key]) orphanKeyGroups[key] = new Set();
    orphanKeyGroups[key].add(item.sourceId);
  }

  // Check orphans matching existing dups
  const existingDupKeyMap = {};
  const reloadedDups = await Duplicate.find({ type }).lean();
  const reloadedSourceIds = [...new Set(reloadedDups.flatMap(d => d.sourceIds))];
  const reloadedItems = await AssetItem.find({
    sourceId: { $in: reloadedSourceIds }, sourceType: type
  }).select('sourceId identifiers district ward').lean();

  const reloadNotices = await Model.find({ sourceId: { $in: reloadedSourceIds } })
    .select('sourceId organizer').lean();
  const reloadOrgMap = {};
  for (const n of reloadNotices) reloadOrgMap[n.sourceId] = n.organizer || '';

  for (const dup of reloadedDups) {
    const dupOrg = dup.sourceIds.map(sid => reloadOrgMap[sid]).filter(Boolean)[0] || '';
    const dupOrgSlug = dupOrg.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const sid of dup.sourceIds) {
      const matchItems = reloadedItems.filter(i => i.sourceId === sid);
      for (const item of matchItems) {
        const ids = item.identifiers || {};
        if (!ids.plotNumber) continue;
        const key = [`p:${ids.plotNumber}`, `s:${ids.mapSheet || '?'}`,
          `d:${(item.district || '?').toLowerCase().trim()}`,
          `w:${(item.ward || '?').toLowerCase().trim()}`,
          `org:${dupOrgSlug}`].join('|');
        if (!existingDupKeyMap[key]) existingDupKeyMap[key] = dup;
      }
    }
  }

  let phase2Created = 0, phase2Merged = 0;

  for (const [key, sourceIdSet] of Object.entries(orphanKeyGroups)) {
    const sourceIds = [...sourceIdSet].sort((a, b) => a - b);
    if (sourceIds.length < 2 && !existingDupKeyMap[key]) continue;

    const existingDup = existingDupKeyMap[key];
    if (existingDup) {
      const mergedIds = [...new Set([...existingDup.sourceIds, ...sourceIds])].sort((a, b) => a - b);
      await Duplicate.updateOne({ _id: existingDup._id }, { $set: { sourceIds: mergedIds } });
      for (const sid of sourceIds) {
        await Model.updateOne({ sourceId: sid }, { $set: { rootId: existingDup.rootId } });
      }
      phase2Merged++;
    } else if (sourceIds.length >= 2) {
      const rootId = sourceIds[0];
      const name = orphanOrgMap[sourceIds[0]]?.name || '';
      await Duplicate.create({ type, name, sourceIds, rootId, relistCount: sourceIds.length, entries: [] });
      for (const sid of sourceIds) {
        await Model.updateOne({ sourceId: sid }, { $set: { rootId } });
      }
      phase2Created++;
    }
  }

  console.log(`[Phase 2] Created ${phase2Created} new groups, merged ${phase2Merged} orphans into existing groups`);
  if (saveProgress) await saveProgress(`[Phase 2] Tạo ${phase2Created} nhóm mới, gom ${phase2Merged} tin đơn lẻ.`);
}

async function auditTPHCM() {
  const orgName = /trung.*t[aâ]m.*d[iị]ch.*v[uụ].*b[aá]n.*đ[aấ]u.*gi[aá].*t[aà]i.*s[aả]n.*t(p|hcm|phcm)/i;
  const notices = await AuctionNotice.find({ organizer: orgName })
    .select('sourceId name rootId').lean();
  const sourceIds = notices.map(n => n.sourceId);
  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' }).lean();

  const byRootId = {};
  const noRoot = [];
  for (const n of notices) {
    if (n.rootId) {
      if (!byRootId[n.rootId]) byRootId[n.rootId] = [];
      byRootId[n.rootId].push(n);
    } else noRoot.push(n);
  }

  const identifierGroups = {};
  for (const item of items) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const key = `plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${item.district || '?'}|w:${item.ward || '?'}`;
    if (!identifierGroups[key]) identifierGroups[key] = [];
    const notice = notices.find(n => n.sourceId === item.sourceId);
    identifierGroups[key].push({ sourceId: item.sourceId, rootId: notice?.rootId || null });
  }

  const multiAppearIds = Object.entries(identifierGroups).filter(([k, v]) => v.length >= 2);
  let missedCount = 0;
  const missedGroups = [];
  for (const [key, group] of multiAppearIds) {
    const distinctRoots = [...new Set(group.map(g => g.rootId || `solo_${g.sourceId}`))];
    if (distinctRoots.length > 1) {
      missedCount++;
      missedGroups.push({ key, count: group.length, roots: distinctRoots.length });
    }
  }
  const correctlyGrouped = multiAppearIds.length - missedCount;

  return {
    totalNotices: notices.length,
    groupedCount: notices.filter(n => n.rootId).length,
    noRootCount: noRoot.length,
    rootIdCount: Object.keys(byRootId).length,
    multiAppearCount: multiAppearIds.length,
    correctlyGrouped, missedCount,
    accuracy: (correctlyGrouped / Math.max(multiAppearIds.length, 1) * 100).toFixed(1),
    topMissed: missedGroups.sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

async function run() {
  await connectDB();

  console.log('\n' + '='.repeat(80));
  console.log('=== TRƯỚC KHI MERGE ===');
  console.log('='.repeat(80));
  const before = await auditTPHCM();
  console.log(`Tổng: ${before.totalNotices} | rootId: ${before.groupedCount} | noRoot: ${before.noRootCount}`);
  console.log(`Nhóm rootId: ${before.rootIdCount} | Đúng: ${before.correctlyGrouped} | Lọt: ${before.missedCount} | ${before.accuracy}%`);
  for (const m of before.topMissed.slice(0, 5)) console.log(`  ${m.key}: ${m.count} tin, ${m.roots} rootId`);

  console.log('\n' + '='.repeat(80));
  console.log('=== ĐANG CHẠY CROSS-GROUP MERGE (Phase 1 + 2) ===');
  console.log('='.repeat(80));
  await mergeIdenticalAssetGroups('auction', (msg) => console.log(msg), () => false);

  console.log('\n' + '='.repeat(80));
  console.log('=== SAU KHI MERGE ===');
  console.log('='.repeat(80));
  const after = await auditTPHCM();
  console.log(`Tổng: ${after.totalNotices} | rootId: ${after.groupedCount} | noRoot: ${after.noRootCount}`);
  console.log(`Nhóm rootId: ${after.rootIdCount} | Đúng: ${after.correctlyGrouped} | Lọt: ${after.missedCount} | ${after.accuracy}%`);
  for (const m of after.topMissed.slice(0, 5)) console.log(`  ${m.key}: ${m.count} tin, ${m.roots} rootId`);

  console.log('\n' + '='.repeat(80));
  console.log('=== SO SÁNH ===');
  console.log('='.repeat(80));
  console.log(`Bị lọt: ${before.missedCount} → ${after.missedCount} (giảm ${before.missedCount - after.missedCount})`);
  console.log(`Chính xác: ${before.accuracy}% → ${after.accuracy}%`);
  console.log(`Nhóm rootId: ${before.rootIdCount} → ${after.rootIdCount} (giảm ${before.rootIdCount - after.rootIdCount})`);
  console.log(`Không rootId: ${before.noRootCount} → ${after.noRootCount} (giảm ${before.noRootCount - after.noRootCount})`);

  await closeDB();
}

run().catch(console.error);
