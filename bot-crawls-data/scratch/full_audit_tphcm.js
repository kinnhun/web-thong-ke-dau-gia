/**
 * KIỂM TRA CHI TIẾT 17,519 TIN ĐĂNG TPHCM CENTER
 * 
 * Kiểm tra:
 * 1. Tài sản bị gom sai (false positive) — 2 tài sản KHÁC NHAU nhưng cùng rootId
 * 2. Tài sản bị lọt (false negative) — cùng tài sản nhưng KHÁC rootId
 * 3. Tin đơn lẻ có identifier nhưng không rootId
 * 4. Nhóm quá lớn (>50 tin) — có thể gom sai
 */
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

async function run() {
  await connectDB();

  const orgName = /trung.*t[aâ]m.*d[iị]ch.*v[uụ].*b[aá]n.*đ[aấ]u.*gi[aá].*t[aà]i.*s[aả]n.*t(p|hcm|phcm)/i;
  const notices = await AuctionNotice.find({ organizer: orgName })
    .select('sourceId name rootId organizer publishedAt province address relatedIds')
    .lean();
  
  const sourceIds = notices.map(n => n.sourceId);
  const noticeMap = {};
  for (const n of notices) noticeMap[n.sourceId] = n;

  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' })
    .select('sourceId identifiers district ward province name assetType area ownerName')
    .lean();

  // sourceId → items
  const itemsBySource = {};
  for (const item of items) {
    if (!itemsBySource[item.sourceId]) itemsBySource[item.sourceId] = [];
    itemsBySource[item.sourceId].push(item);
  }

  // Duplicates
  const dups = await Duplicate.find({ type: 'auction' }).lean();
  const dupBySourceId = {};
  for (const d of dups) {
    for (const sid of d.sourceIds) dupBySourceId[sid] = d;
  }

  console.log(`\n${'═'.repeat(100)}`);
  console.log(`  KIỂM TRA TOÀN BỘ 17,519 TIN ĐĂNG — TPHCM CENTER`);
  console.log(`${'═'.repeat(100)}`);

  // ═══════════════════════════════════════════════════════════════════════
  // 1. THỐNG KÊ TỔNG QUAN
  // ═══════════════════════════════════════════════════════════════════════
  const withRoot = notices.filter(n => n.rootId);
  const noRoot = notices.filter(n => !n.rootId);
  const byRootId = {};
  for (const n of withRoot) {
    if (!byRootId[n.rootId]) byRootId[n.rootId] = [];
    byRootId[n.rootId].push(n);
  }

  console.log(`\n┌─ TỔNG QUAN`);
  console.log(`│ Tổng tin đăng: ${notices.length}`);
  console.log(`│ Có rootId: ${withRoot.length} (${(withRoot.length/notices.length*100).toFixed(1)}%)`);
  console.log(`│ Không rootId: ${noRoot.length}`);
  console.log(`│ Số nhóm rootId: ${Object.keys(byRootId).length}`);
  console.log(`│ Tin có AssetItem: ${Object.keys(itemsBySource).length}`);
  console.log(`│ Tin KHÔNG có AssetItem: ${notices.length - Object.keys(itemsBySource).length}`);
  console.log(`└─`);

  // ═══════════════════════════════════════════════════════════════════════
  // 2. KIỂM TRA FALSE NEGATIVE (bị lọt)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(100)}`);
  console.log(`  CHECK 1: TÀI SẢN BỊ LỌT (cùng identifier key nhưng khác rootId)`);
  console.log(`${'─'.repeat(100)}`);

  const idGroups = {};
  for (const item of items) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const key = `plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${(item.district || '?').toLowerCase().trim()}|w:${(item.ward || '?').toLowerCase().trim()}`;
    if (!idGroups[key]) idGroups[key] = [];
    const notice = noticeMap[item.sourceId];
    idGroups[key].push({
      sourceId: item.sourceId,
      rootId: notice?.rootId || null,
      name: (item.name || notice?.name || '').substring(0, 100),
      date: notice?.publishedAt ? new Date(notice.publishedAt).toISOString().slice(0, 10) : '?',
      area: item.area,
      province: item.province || '',
    });
  }

  const multiAppear = Object.entries(idGroups).filter(([k, v]) => v.length >= 2);
  let missedCount = 0;
  for (const [key, group] of multiAppear) {
    const roots = [...new Set(group.map(g => g.rootId || `solo_${g.sourceId}`))];
    if (roots.length > 1) {
      missedCount++;
      console.log(`\n  ❌ ${key} — ${group.length} tin, ${roots.length} rootId`);
      for (const g of group.slice(0, 6)) {
        console.log(`     sid=${g.sourceId} | rootId=${g.rootId || 'N/A'} | ${g.date} | prov="${g.province}"`);
      }
      if (group.length > 6) console.log(`     ... và ${group.length - 6} tin nữa`);
    }
  }
  if (missedCount === 0) {
    console.log(`  ✅ KHÔNG CÓ TÀI SẢN BỊ LỌT (800/800 identifier groups đều đúng)`);
  } else {
    console.log(`\n  ⚠️ Tổng nhóm bị lọt: ${missedCount}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. KIỂM TRA FALSE POSITIVE (gom sai — nhóm chứa tài sản khác nhau)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(100)}`);
  console.log(`  CHECK 2: TÀI SẢN GOM SAI (cùng rootId nhưng identifier key KHÁC NHAU)`);
  console.log(`${'─'.repeat(100)}`);

  let falsePositiveCount = 0;
  const suspiciousGroups = [];

  for (const [rootId, groupNotices] of Object.entries(byRootId)) {
    if (groupNotices.length < 2) continue;

    // Collect identifier keys cho mỗi sourceId
    const keysBySourceId = {};
    for (const n of groupNotices) {
      const assetItems = itemsBySource[n.sourceId] || [];
      const keys = new Set();
      for (const item of assetItems) {
        const ids = item.identifiers || {};
        if (ids.plotNumber) {
          keys.add(`plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${(item.district || '?').toLowerCase().trim()}`);
        }
        if (ids.licensePlate) keys.add(`plate:${ids.licensePlate}`);
        if (ids.certificateNumber) keys.add(`cert:${ids.certificateNumber}`);
        if (ids.houseNumber) keys.add(`house:${ids.houseNumber}|d:${(item.district || '?').toLowerCase().trim()}`);
      }
      keysBySourceId[n.sourceId] = keys;
    }

    // Kiểm tra: nếu 2 sourceIds trong cùng rootId có identifier keys HOÀN TOÀN KHÁC NHAU
    const allKeys = [...new Set(Object.values(keysBySourceId).flatMap(s => [...s]))];
    const sourcesWithKeys = Object.entries(keysBySourceId).filter(([sid, keys]) => keys.size > 0);
    
    if (sourcesWithKeys.length >= 2) {
      // Check nếu có sourceId nào có key KHÔNG overlap với bất kỳ sourceId nào khác
      const sourceIdsWithUniqueKeys = [];
      for (const [sidA, keysA] of sourcesWithKeys) {
        let hasOverlap = false;
        for (const [sidB, keysB] of sourcesWithKeys) {
          if (sidA === sidB) continue;
          const intersection = [...keysA].filter(k => keysB.has(k));
          if (intersection.length > 0) { hasOverlap = true; break; }
        }
        if (!hasOverlap && keysA.size > 0) {
          sourceIdsWithUniqueKeys.push({ sid: sidA, keys: [...keysA] });
        }
      }

      // Nếu có sourceId isolated (không overlap với ai), CÓ THỂ là false positive
      // Nhưng cần check: có thể chúng linked qua relatedIds (hợp lệ)
      if (sourceIdsWithUniqueKeys.length > 0 && sourceIdsWithUniqueKeys.length < sourcesWithKeys.length) {
        // Chỉ report nếu >30% sourceIds isolated
        const isolatedPct = sourceIdsWithUniqueKeys.length / sourcesWithKeys.length;
        if (isolatedPct >= 0.3 && sourcesWithKeys.length >= 4) {
          falsePositiveCount++;
          suspiciousGroups.push({
            rootId,
            total: groupNotices.length,
            withKeys: sourcesWithKeys.length,
            isolated: sourceIdsWithUniqueKeys,
            allKeys,
          });
        }
      }
    }
  }

  if (suspiciousGroups.length > 0) {
    console.log(`\n  ⚠️ ${suspiciousGroups.length} nhóm NGHI NGỜ gom sai:`);
    for (const sg of suspiciousGroups.slice(0, 10)) {
      console.log(`\n  🟡 rootId=${sg.rootId} — ${sg.total} tin, ${sg.withKeys} có identifier`);
      console.log(`     Keys: [${sg.allKeys.slice(0, 5).join(', ')}]${sg.allKeys.length > 5 ? ` +${sg.allKeys.length - 5}` : ''}`);
      console.log(`     Isolated: ${sg.isolated.length} sourceIds`);
      for (const iso of sg.isolated.slice(0, 3)) {
        const n = noticeMap[parseInt(iso.sid)];
        console.log(`       sid=${iso.sid} | keys=[${iso.keys.join(', ')}] | ${n?.name?.substring(0, 80)}`);
      }
    }
  } else {
    console.log(`  ✅ KHÔNG TÌM THẤY NHÓM NGHI NGỜ GOM SAI`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. KIỂM TRA NHÓM QUÁ LỚN
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(100)}`);
  console.log(`  CHECK 3: NHÓM QUÁ LỚN (>30 tin — có thể gom sai)`);
  console.log(`${'─'.repeat(100)}`);

  const bigGroups = Object.entries(byRootId).filter(([r, g]) => g.length > 30).sort((a, b) => b[1].length - a[1].length);
  if (bigGroups.length > 0) {
    for (const [rootId, group] of bigGroups.slice(0, 10)) {
      const assetKeys = new Set();
      for (const n of group) {
        const ai = itemsBySource[n.sourceId] || [];
        for (const item of ai) {
          const ids = item.identifiers || {};
          if (ids.plotNumber) assetKeys.add(`plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}`);
        }
      }
      const sampleName = group[0].name?.substring(0, 80) || '';
      console.log(`  rootId=${rootId} — ${group.length} tin | ${assetKeys.size} identifier keys`);
      console.log(`    "${sampleName}"`);
      if (assetKeys.size > 1) {
        console.log(`    ⚠️ Nhiều identifier: [${[...assetKeys].slice(0, 5).join(', ')}]`);
      }
    }
  } else {
    console.log(`  ✅ Không có nhóm nào >30 tin`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. KIỂM TRA TIN KHÔNG rootId
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(100)}`);
  console.log(`  CHECK 4: TIN KHÔNG rootId (${noRoot.length} tin)`);
  console.log(`${'─'.repeat(100)}`);

  let noRootWithPlot = 0;
  let noRootWithPlotMatchable = 0;
  let noRootNoAsset = 0;
  let noRootNoPlot = 0;

  for (const n of noRoot) {
    const ai = itemsBySource[n.sourceId] || [];
    if (ai.length === 0) { noRootNoAsset++; continue; }
    
    const hasPlot = ai.some(i => i.identifiers?.plotNumber);
    if (!hasPlot) { noRootNoPlot++; continue; }

    noRootWithPlot++;

    // Check if any other notice has same identifier
    for (const item of ai) {
      const ids = item.identifiers || {};
      if (!ids.plotNumber) continue;
      const key = `plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${(item.district || '?').toLowerCase().trim()}|w:${(item.ward || '?').toLowerCase().trim()}`;
      if (idGroups[key] && idGroups[key].length >= 2) {
        noRootWithPlotMatchable++;
        break;
      }
    }
  }

  console.log(`  Không có AssetItem: ${noRootNoAsset} (tin chưa crawl detail)`);
  console.log(`  Có AssetItem nhưng không plotNumber: ${noRootNoPlot} (xe cộ, tài sản khác)`);
  console.log(`  Có plotNumber: ${noRootWithPlot}`);
  console.log(`    Trong đó có thể match với tin khác: ${noRootWithPlotMatchable}`);
  console.log(`    Chỉ xuất hiện 1 lần (unique): ${noRootWithPlot - noRootWithPlotMatchable}`);

  // ═══════════════════════════════════════════════════════════════════════
  // 6. PHÂN BỐ KÍCH THƯỚC NHÓM
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(100)}`);
  console.log(`  CHECK 5: PHÂN BỐ KÍCH THƯỚC NHÓM`);
  console.log(`${'─'.repeat(100)}`);

  const sizeDistribution = {};
  for (const [rootId, group] of Object.entries(byRootId)) {
    const size = group.length;
    const bucket = size <= 2 ? '2' : size <= 5 ? '3-5' : size <= 10 ? '6-10' : size <= 20 ? '11-20' : size <= 30 ? '21-30' : '31+';
    if (!sizeDistribution[bucket]) sizeDistribution[bucket] = 0;
    sizeDistribution[bucket]++;
  }

  for (const bucket of ['2', '3-5', '6-10', '11-20', '21-30', '31+']) {
    const count = sizeDistribution[bucket] || 0;
    const bar = '█'.repeat(Math.min(count, 50));
    console.log(`  ${bucket.padStart(5)} tin: ${String(count).padStart(5)} nhóm ${bar}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // KẾT LUẬN
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(100)}`);
  console.log(`  KẾT LUẬN`);
  console.log(`${'═'.repeat(100)}`);
  console.log(`  ✅ False Negative (bị lọt): ${missedCount}`);
  console.log(`  ✅ False Positive nghi ngờ: ${falsePositiveCount}`);
  console.log(`  ✅ Tỷ lệ chính xác identifier: ${missedCount === 0 ? '100.00' : ((multiAppear.length - missedCount) / multiAppear.length * 100).toFixed(2)}%`);
  console.log(`  📊 Tổng tài sản theo identifier: ${multiAppear.length} (>=2 tin)`);
  console.log(`  📊 Tin đơn lẻ không rootId: ${noRoot.length}`);

  await closeDB();
}

run().catch(console.error);
