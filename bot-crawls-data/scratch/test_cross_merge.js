/**
 * Test script: Chạy mergeIdenticalAssetGroups trên dữ liệu hiện có
 * rồi audit lại TPHCM center xem kết quả cải thiện bao nhiêu.
 */
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

// Import function directly from the module
let mergeIdenticalAssetGroups;

async function importMergeFunction() {
  // We need to load the function from detail.scraper.js
  // But it's not exported yet, so we'll inline it here for testing
  const OrgSelection = require('../src/models/OrgSelection');
  const { extractPropertyIdentifiers, normalizeProvince } = require('../src/utils/helpers');

  mergeIdenticalAssetGroups = async function(type, saveProgress, checkCancelled) {
    const label = type === 'auction' ? 'AuctionNotice' : 'OrgSelection';
    const Model = type === 'auction' ? AuctionNotice : OrgSelection;

    if (saveProgress) await saveProgress(`[Cross-Merge] Đang tải Duplicate records (${label})...`);

    const duplicates = await Duplicate.find({ type }).lean();
    if (duplicates.length === 0) return;

    if (saveProgress) await saveProgress(`[Cross-Merge] Đang phân tích ${duplicates.length} nhóm duplicate...`);

    const allSourceIds = [...new Set(duplicates.flatMap(d => d.sourceIds))];

    const items = await AssetItem.find({
      sourceId: { $in: allSourceIds },
      sourceType: type
    }).select('sourceId identifiers district ward assetType province').lean();

    const notices = await Model.find({ sourceId: { $in: allSourceIds } })
      .select('sourceId organizer')
      .lean();
    const orgMap = {};
    for (const n of notices) {
      orgMap[n.sourceId] = n.organizer || '';
    }

    const sourceIdKeys = {};
    for (const item of items) {
      const ids = item.identifiers || {};
      if (!ids.plotNumber) continue;

      const key = [
        `p:${ids.plotNumber}`,
        `s:${ids.mapSheet || '?'}`,
        `d:${(item.district || '?').toLowerCase().trim()}`,
        `w:${(item.ward || '?').toLowerCase().trim()}`,
      ].join('|');

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

    const dupById = {};
    for (const d of duplicates) dupById[d._id.toString()] = d;

    const parent = {};
    for (const d of duplicates) parent[d._id.toString()] = d._id.toString();

    const find = (id) => {
      if (parent[id] === id) return id;
      return parent[id] = find(parent[id]);
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    let mergeableKeys = 0;
    for (const [key, dupIdSet] of Object.entries(keyToDupIds)) {
      const dupIds = [...dupIdSet];
      if (dupIds.length < 2) continue;
      mergeableKeys++;
      for (let i = 1; i < dupIds.length; i++) {
        union(dupIds[0], dupIds[i]);
      }
    }

    if (mergeableKeys === 0) {
      if (saveProgress) await saveProgress(`[Cross-Merge] Không tìm thấy nhóm nào cần merge.`);
      return;
    }

    const groupsByRoot = {};
    for (const d of duplicates) {
      const root = find(d._id.toString());
      if (!groupsByRoot[root]) groupsByRoot[root] = [];
      groupsByRoot[root].push(d);
    }

    const toMerge = Object.values(groupsByRoot).filter(g => g.length > 1);

    if (saveProgress) await saveProgress(`[Cross-Merge] Đang merge ${toMerge.length} nhóm duplicate bị tách...`);
    console.log(`[Cross-Merge] Found ${toMerge.length} groups to merge (from ${mergeableKeys} shared keys)`);

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

      bulkOps.push({
        updateOne: {
          filter: { _id: keeper._id },
          update: { $set: { sourceIds: allIds, rootId, name: keeper.name } }
        }
      });

      for (const d of group) {
        if (d._id.toString() !== keeperId) {
          idsToDelete.push(d._id);
        }
      }

      mergedCount++;
    }

    if (bulkOps.length > 0) {
      await Duplicate.bulkWrite(bulkOps, { ordered: false });
    }

    if (idsToDelete.length > 0) {
      await Duplicate.deleteMany({ _id: { $in: idsToDelete } });
    }

    // Cập nhật rootId trên notices
    if (saveProgress) await saveProgress(`[Cross-Merge] Đang cập nhật rootId cho ${label}...`);

    const updatedDups = await Duplicate.find({ type }).lean();
    const rootBulkOps = [];
    for (const dup of updatedDups) {
      if (!dup.rootId) continue;
      for (const sid of dup.sourceIds) {
        rootBulkOps.push({
          updateOne: {
            filter: { sourceId: sid },
            update: { $set: { rootId: dup.rootId } }
          }
        });
      }
    }

    if (rootBulkOps.length > 0) {
      for (let i = 0; i < rootBulkOps.length; i += 5000) {
        const batch = rootBulkOps.slice(i, i + 5000);
        await Model.bulkWrite(batch, { ordered: false });
      }
    }

    console.log(`[Cross-Merge] Merged ${mergedCount} groups, deleted ${idsToDelete.length} duplicate records`);
    if (saveProgress) await saveProgress(`[Cross-Merge] Hoàn tất: merge ${mergedCount} nhóm, xóa ${idsToDelete.length} bản ghi trùng.`);
  };
}

async function auditTPHCM() {
  const orgName = /trung.*t[aâ]m.*d[iị]ch.*v[uụ].*b[aá]n.*đ[aấ]u.*gi[aá].*t[aà]i.*s[aả]n.*t(p|hcm|phcm)/i;
  const notices = await AuctionNotice.find({ organizer: orgName })
    .select('sourceId name rootId province')
    .lean();

  const sourceIds = notices.map(n => n.sourceId);
  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' }).lean();

  const byRootId = {};
  const noRoot = [];
  for (const n of notices) {
    if (n.rootId) {
      if (!byRootId[n.rootId]) byRootId[n.rootId] = [];
      byRootId[n.rootId].push(n);
    } else {
      noRoot.push(n);
    }
  }

  // Check missed mapping
  const identifierGroups = {};
  for (const item of items) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const key = `plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${item.district || '?'}|w:${item.ward || '?'}`;
    if (!identifierGroups[key]) identifierGroups[key] = [];
    const notice = notices.find(n => n.sourceId === item.sourceId);
    identifierGroups[key].push({
      sourceId: item.sourceId,
      rootId: notice?.rootId || null,
    });
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
    correctlyGrouped,
    missedCount,
    accuracy: (correctlyGrouped / Math.max(multiAppearIds.length, 1) * 100).toFixed(1),
    topMissed: missedGroups.sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

async function run() {
  await connectDB();
  await importMergeFunction();

  console.log('\n' + '='.repeat(80));
  console.log('=== TRƯỚC KHI MERGE ===');
  console.log('='.repeat(80));
  
  const before = await auditTPHCM();
  console.log(`Tổng tin đăng: ${before.totalNotices}`);
  console.log(`Có rootId: ${before.groupedCount} (${(before.groupedCount/before.totalNotices*100).toFixed(1)}%)`);
  console.log(`Không rootId: ${before.noRootCount}`);
  console.log(`Số nhóm rootId: ${before.rootIdCount}`);
  console.log(`Tài sản >=2 lần - Đúng: ${before.correctlyGrouped}`);
  console.log(`Tài sản >=2 lần - Sai/Lọt: ${before.missedCount}`);
  console.log(`Tỷ lệ chính xác: ${before.accuracy}%`);
  if (before.topMissed.length > 0) {
    console.log(`\nTop nhóm bị lọt:`);
    for (const m of before.topMissed) {
      console.log(`  ${m.key}: ${m.count} tin, ${m.roots} rootId`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('=== ĐANG CHẠY CROSS-GROUP MERGE ===');
  console.log('='.repeat(80));

  await mergeIdenticalAssetGroups('auction', (msg) => console.log(msg), () => false);

  console.log('\n' + '='.repeat(80));
  console.log('=== SAU KHI MERGE ===');
  console.log('='.repeat(80));

  const after = await auditTPHCM();
  console.log(`Tổng tin đăng: ${after.totalNotices}`);
  console.log(`Có rootId: ${after.groupedCount} (${(after.groupedCount/after.totalNotices*100).toFixed(1)}%)`);
  console.log(`Không rootId: ${after.noRootCount}`);
  console.log(`Số nhóm rootId: ${after.rootIdCount}`);
  console.log(`Tài sản >=2 lần - Đúng: ${after.correctlyGrouped}`);
  console.log(`Tài sản >=2 lần - Sai/Lọt: ${after.missedCount}`);
  console.log(`Tỷ lệ chính xác: ${after.accuracy}%`);
  if (after.topMissed.length > 0) {
    console.log(`\nTop nhóm vẫn bị lọt:`);
    for (const m of after.topMissed) {
      console.log(`  ${m.key}: ${m.count} tin, ${m.roots} rootId`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('=== SO SÁNH KẾT QUẢ ===');
  console.log('='.repeat(80));
  console.log(`Bị lọt: ${before.missedCount} → ${after.missedCount} (giảm ${before.missedCount - after.missedCount})`);
  console.log(`Chính xác: ${before.accuracy}% → ${after.accuracy}%`);
  console.log(`Số nhóm rootId: ${before.rootIdCount} → ${after.rootIdCount} (giảm ${before.rootIdCount - after.rootIdCount})`);

  await closeDB();
}

run().catch(console.error);
