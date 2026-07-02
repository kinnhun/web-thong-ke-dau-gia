const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

async function run() {
  await connectDB();

  // 1. Lấy tất cả tin đăng của Trung tâm TPHCM
  const orgName = /trung.*t[aâ]m.*d[iị]ch.*v[uụ].*b[aá]n.*đ[aấ]u.*gi[aá].*t[aà]i.*s[aả]n.*t(p|hcm|phcm)/i;
  const notices = await AuctionNotice.find({ organizer: orgName })
    .select('sourceId name rootId publishRound relatedIds province address organizer owner initialPrice publishedAt')
    .sort({ publishedAt: 1 })
    .lean();

  console.log(`\n=== TỔNG TIN ĐĂNG: ${notices.length} ===\n`);

  // 2. Phân nhóm theo rootId
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

  const rootIds = Object.keys(byRootId);
  console.log(`Số nhóm rootId: ${rootIds.length}`);
  console.log(`Số tin KHÔNG có rootId: ${noRoot.length}`);
  console.log(`Số tin CÓ rootId (đã gom nhóm): ${notices.length - noRoot.length}`);

  // 3. Lấy tất cả AssetItem của organizer
  const sourceIds = notices.map(n => n.sourceId);
  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' }).lean();
  console.log(`Tổng AssetItem: ${items.length}`);

  // Group items by sourceId
  const itemsBySource = {};
  for (const item of items) {
    if (!itemsBySource[item.sourceId]) itemsBySource[item.sourceId] = [];
    itemsBySource[item.sourceId].push(item);
  }

  // 4. TÌM TÀI SẢN BỊ LỌT (cùng identifiers nhưng khác rootId)
  console.log(`\n${'='.repeat(80)}`);
  console.log(`=== PHÂN TÍCH TÀI SẢN BỊ LỌT (chưa gom nhóm) ===`);
  console.log(`${'='.repeat(80)}\n`);

  // Build a map: key = "plotNumber|mapSheet|district|ward" → list of {sourceId, rootId, ...}
  const identifierGroups = {};
  for (const item of items) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue; // Skip items without plotNumber

    const key = `plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${item.district || '?'}|w:${item.ward || '?'}`;
    if (!identifierGroups[key]) identifierGroups[key] = [];
    
    const notice = notices.find(n => n.sourceId === item.sourceId);
    identifierGroups[key].push({
      sourceId: item.sourceId,
      itemIndex: item.itemIndex,
      rootId: notice?.rootId || null,
      publishRound: notice?.publishRound || 0,
      price: item.startingPrice || notice?.initialPrice || 0,
      name: item.name?.substring(0, 100),
      publishedAt: notice?.publishedAt,
      assetType: item.assetType,
      certNumber: ids.certificateNumber || null,
    });
  }

  // Find groups where items have DIFFERENT rootIds (= missed mapping)
  let missedCount = 0;
  const missedGroups = [];
  for (const [key, group] of Object.entries(identifierGroups)) {
    if (group.length < 2) continue;
    
    const distinctRoots = [...new Set(group.map(g => g.rootId || `solo_${g.sourceId}`))];
    if (distinctRoots.length > 1) {
      missedCount++;
      missedGroups.push({ key, group, distinctRoots });
    }
  }

  console.log(`Số nhóm identifier có >=2 tin nhưng KHÁC rootId: ${missedCount}\n`);

  // Print top 30 missed groups
  const sortedMissed = missedGroups
    .sort((a, b) => b.group.length - a.group.length)
    .slice(0, 30);

  for (const { key, group, distinctRoots } of sortedMissed) {
    console.log(`--- ${key} (${group.length} tin, ${distinctRoots.length} rootId khác nhau) ---`);
    // Group by rootId
    const byRoot = {};
    for (const g of group) {
      const rk = g.rootId || `solo_${g.sourceId}`;
      if (!byRoot[rk]) byRoot[rk] = [];
      byRoot[rk].push(g);
    }
    for (const [root, items_] of Object.entries(byRoot)) {
      console.log(`  RootId: ${root} (${items_.length} tin)`);
      for (const g of items_.slice(0, 3)) {
        console.log(`    sourceId=${g.sourceId} round=${g.publishRound} price=${g.price?.toLocaleString()} type=${g.assetType}`);
        console.log(`      ${g.name}...`);
      }
      if (items_.length > 3) console.log(`    ...và ${items_.length - 3} tin nữa`);
    }
    console.log('');
  }

  // 5. TÌM TÀI SẢN CHƯA CÓ ROOT ID
  console.log(`\n${'='.repeat(80)}`);
  console.log(`=== TIN ĐĂNG CHƯA CÓ ROOT ID (${noRoot.length} tin) ===`);
  console.log(`${'='.repeat(80)}\n`);

  for (const n of noRoot.slice(0, 20)) {
    const myItems = itemsBySource[n.sourceId] || [];
    console.log(`SourceId: ${n.sourceId} | ${n.publishedAt?.toISOString().slice(0,10) || '?'} | Price: ${n.initialPrice?.toLocaleString()}`);
    console.log(`  Name: ${n.name?.substring(0, 120)}...`);
    for (const item of myItems) {
      console.log(`  Item#${item.itemIndex}: type=${item.assetType} ids=${JSON.stringify(item.identifiers)}`);
    }
    console.log('');
  }
  if (noRoot.length > 20) console.log(`  ...và ${noRoot.length - 20} tin nữa\n`);

  // 6. THỐNG KÊ TÓM TẮT
  console.log(`\n${'='.repeat(80)}`);
  console.log(`=== THỐNG KÊ TÓM TẮT ===`);
  console.log(`${'='.repeat(80)}\n`);

  const totalGrouped = notices.filter(n => n.rootId).length;
  const totalSingle = noRoot.length;
  
  // Count distinct identifiers that appear in multiple notices
  const multiAppearIds = Object.entries(identifierGroups).filter(([k, v]) => v.length >= 2);
  const correctlyGrouped = multiAppearIds.filter(([k, v]) => {
    const roots = [...new Set(v.map(g => g.rootId || `solo_${g.sourceId}`))];
    return roots.length === 1;
  });

  console.log(`Tổng tin đăng: ${notices.length}`);
  console.log(`Đã gom nhóm (có rootId): ${totalGrouped} (${(totalGrouped/notices.length*100).toFixed(1)}%)`);
  console.log(`Chưa gom nhóm (không rootId): ${totalSingle} (${(totalSingle/notices.length*100).toFixed(1)}%)`);
  console.log(`Số nhóm tài sản (rootId): ${rootIds.length}`);
  console.log(`Tài sản có plotNumber xuất hiện >=2 lần: ${multiAppearIds.length}`);
  console.log(`  - Gom nhóm ĐÚNG: ${correctlyGrouped.length}`);
  console.log(`  - Gom nhóm SAI/LỌT: ${missedCount}`);
  console.log(`Tỷ lệ chính xác: ${(correctlyGrouped.length / Math.max(multiAppearIds.length, 1) * 100).toFixed(1)}%`);

  // 7. Check assetType distribution
  console.log(`\n--- Phân bố AssetType ---`);
  const typeDist = {};
  for (const item of items) {
    typeDist[item.assetType] = (typeDist[item.assetType] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} (${(count/items.length*100).toFixed(1)}%)`);
  }

  await closeDB();
}

run().catch(console.error);
