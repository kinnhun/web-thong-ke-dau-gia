/**
 * Test script v3: Tối ưu Phase 2 - dùng Map thay vì filter()
 */
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const OrgSelection = require('../src/models/OrgSelection');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

function buildIdentifierKey(ids, district, ward) {
  return [`p:${ids.plotNumber}`, `s:${ids.mapSheet || '?'}`,
    `d:${(district || '?').toLowerCase().trim()}`,
    `w:${(ward || '?').toLowerCase().trim()}`].join('|');
}

async function phase2OrphanMerge(type, saveProgress) {
  const label = type === 'auction' ? 'AuctionNotice' : 'OrgSelection';
  const Model = type === 'auction' ? AuctionNotice : OrgSelection;

  if (saveProgress) await saveProgress(`[Phase 2] Đang tìm tin đơn lẻ chưa gom nhóm...`);

  // 1. Lấy tất cả sourceIds đã có trong Duplicate
  const currentDups = await Duplicate.find({ type }).select('sourceIds rootId name').lean();
  const groupedSourceIds = new Set(currentDups.flatMap(d => d.sourceIds));
  console.log(`  Tổng Duplicate records: ${currentDups.length}, sourceIds đã gom: ${groupedSourceIds.size}`);

  // 2. Lấy tất cả AssetItem có plotNumber
  const allItems = await AssetItem.find({ 
    sourceType: type, 
    'identifiers.plotNumber': { $exists: true, $ne: null }
  }).select('sourceId identifiers district ward').lean();
  console.log(`  Tổng AssetItem có plotNumber: ${allItems.length}`);

  // 3. Tách orphan items (không nằm trong Duplicate)
  const orphanItems = allItems.filter(item => !groupedSourceIds.has(item.sourceId));
  console.log(`  Orphan items: ${orphanItems.length}`);

  if (orphanItems.length === 0) {
    console.log(`  Không có orphan items cần xử lý.`);
    return;
  }

  // 4. Lấy organizer cho orphan items
  const orphanSourceIds = [...new Set(orphanItems.map(i => i.sourceId))];
  const orphanNotices = await Model.find({ sourceId: { $in: orphanSourceIds } })
    .select('sourceId organizer name').lean();
  const orphanOrgMap = {};
  for (const n of orphanNotices) {
    orphanOrgMap[n.sourceId] = { organizer: n.organizer || '', name: n.name || '' };
  }

  // 5. Group orphan items by identifier key + organizer
  const orphanKeyGroups = {};
  for (const item of orphanItems) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;

    const org = orphanOrgMap[item.sourceId]?.organizer || '';
    const orgSlug = org.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
    const baseKey = buildIdentifierKey(ids, item.district, item.ward);
    const fullKey = `${baseKey}|org:${orgSlug}`;

    if (!orphanKeyGroups[fullKey]) orphanKeyGroups[fullKey] = new Set();
    orphanKeyGroups[fullKey].add(item.sourceId);
  }

  // 6. Build existing dup key map HIỆU QUẢ (dùng Map thay vì filter)
  console.log(`  Đang build existing dup key map...`);
  
  // Build sourceId → items map cho items ĐÃ trong duplicates
  const groupedItems = allItems.filter(item => groupedSourceIds.has(item.sourceId));
  const itemsBySourceId = new Map();
  for (const item of groupedItems) {
    if (!itemsBySourceId.has(item.sourceId)) itemsBySourceId.set(item.sourceId, []);
    itemsBySourceId.get(item.sourceId).push(item);
  }

  // Build organizer map cho grouped sourceIds
  const groupedNotices = await Model.find({ sourceId: { $in: [...groupedSourceIds].slice(0, 500000) } })
    .select('sourceId organizer').lean();
  const groupedOrgMap = {};
  for (const n of groupedNotices) groupedOrgMap[n.sourceId] = n.organizer || '';

  const existingDupKeyMap = {}; // fullKey → dup
  for (const dup of currentDups) {
    const dupOrg = dup.sourceIds.map(sid => groupedOrgMap[sid]).filter(Boolean)[0] || '';
    const dupOrgSlug = dupOrg.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const sid of dup.sourceIds) {
      const matchItems = itemsBySourceId.get(sid);
      if (!matchItems) continue;
      for (const item of matchItems) {
        const ids = item.identifiers || {};
        if (!ids.plotNumber) continue;
        const baseKey = buildIdentifierKey(ids, item.district, item.ward);
        const fullKey = `${baseKey}|org:${dupOrgSlug}`;
        if (!existingDupKeyMap[fullKey]) existingDupKeyMap[fullKey] = dup;
      }
    }
  }
  console.log(`  Existing dup key map: ${Object.keys(existingDupKeyMap).length} keys`);

  // 7. Merge orphans
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
}

async function auditTPHCM() {
  const orgName = /trung.*t[aâ]m.*d[iị]ch.*v[uụ].*b[aá]n.*đ[aấ]u.*gi[aá].*t[aà]i.*s[aả]n.*t(p|hcm|phcm)/i;
  const notices = await AuctionNotice.find({ organizer: orgName })
    .select('sourceId rootId').lean();
  const sourceIds = notices.map(n => n.sourceId);
  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' })
    .select('sourceId identifiers district ward').lean();

  const byRootId = {};
  let noRoot = 0;
  for (const n of notices) {
    if (n.rootId) {
      if (!byRootId[n.rootId]) byRootId[n.rootId] = [];
      byRootId[n.rootId].push(n);
    } else noRoot++;
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

  const multiAppear = Object.entries(identifierGroups).filter(([k, v]) => v.length >= 2);
  let missed = 0;
  const missedList = [];
  for (const [key, group] of multiAppear) {
    const roots = [...new Set(group.map(g => g.rootId || `solo_${g.sourceId}`))];
    if (roots.length > 1) { missed++; missedList.push({ key, count: group.length, roots: roots.length }); }
  }

  return {
    total: notices.length, grouped: notices.length - noRoot, noRoot,
    rootIds: Object.keys(byRootId).length, correct: multiAppear.length - missed,
    missed, accuracy: ((multiAppear.length - missed) / Math.max(multiAppear.length, 1) * 100).toFixed(1),
    topMissed: missedList.sort((a, b) => b.count - a.count).slice(0, 8),
  };
}

async function run() {
  await connectDB();

  console.log('\n=== TRƯỚC KHI MERGE ===');
  const before = await auditTPHCM();
  console.log(`Tổng: ${before.total} | rootId: ${before.grouped} | noRoot: ${before.noRoot} | nhóm: ${before.rootIds}`);
  console.log(`Đúng: ${before.correct} | Lọt: ${before.missed} | Chính xác: ${before.accuracy}%`);
  for (const m of before.topMissed) console.log(`  ${m.key}: ${m.count} tin, ${m.roots} rootId`);

  console.log('\n=== ĐANG CHẠY PHASE 2 (ORPHAN MERGE) ===');
  await phase2OrphanMerge('auction', (msg) => console.log(msg));

  console.log('\n=== SAU KHI MERGE ===');
  const after = await auditTPHCM();
  console.log(`Tổng: ${after.total} | rootId: ${after.grouped} | noRoot: ${after.noRoot} | nhóm: ${after.rootIds}`);
  console.log(`Đúng: ${after.correct} | Lọt: ${after.missed} | Chính xác: ${after.accuracy}%`);
  if (after.topMissed.length > 0) {
    console.log(`Vẫn bị lọt:`);
    for (const m of after.topMissed) console.log(`  ${m.key}: ${m.count} tin, ${m.roots} rootId`);
  }

  console.log('\n=== SO SÁNH ===');
  console.log(`Lọt: ${before.missed} → ${after.missed} (giảm ${before.missed - after.missed})`);
  console.log(`Chính xác: ${before.accuracy}% → ${after.accuracy}%`);
  console.log(`noRoot: ${before.noRoot} → ${after.noRoot} (giảm ${before.noRoot - after.noRoot})`);

  await closeDB();
}

run().catch(console.error);
