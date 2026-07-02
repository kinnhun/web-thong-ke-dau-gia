/**
 * Test từng tài sản trong TPHCM center
 * Kiểm tra mọi identifier key, tìm nhóm bị lọt
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
    .select('sourceId name rootId organizer publishedAt province')
    .lean();
  const sourceIds = notices.map(n => n.sourceId);
  const noticeMap = {};
  for (const n of notices) noticeMap[n.sourceId] = n;

  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' })
    .select('sourceId identifiers district ward province name assetType')
    .lean();

  // Group items by identifier key (plotNumber + mapSheet + district + ward)
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
      province: item.province || notice?.province || '',
      date: notice?.publishedAt ? new Date(notice.publishedAt).toISOString().slice(0, 10) : '?',
      name: (item.name || notice?.name || '').substring(0, 80),
    });
  }

  // Analyze
  const multiAppear = Object.entries(idGroups).filter(([k, v]) => v.length >= 2);
  
  let totalCorrect = 0;
  let totalMissed = 0;
  const missedDetails = [];

  for (const [key, group] of multiAppear) {
    const distinctRoots = [...new Set(group.map(g => g.rootId || `solo_${g.sourceId}`))];
    if (distinctRoots.length === 1) {
      totalCorrect++;
    } else {
      totalMissed++;
      missedDetails.push({ key, group, roots: distinctRoots.length });
    }
  }

  console.log(`\n${'═'.repeat(90)}`);
  console.log(`  TPHCM CENTER — KIỂM TRA TỪNG TÀI SẢN`);
  console.log(`${'═'.repeat(90)}`);
  console.log(`  Tổng tin đăng: ${notices.length}`);
  console.log(`  Tin có rootId: ${notices.filter(n => n.rootId).length}`);
  console.log(`  Tin không rootId: ${notices.filter(n => !n.rootId).length}`);
  console.log(`  Tổng tài sản (identifier key, >=2 tin): ${multiAppear.length}`);
  console.log(`  ✅ Gom đúng: ${totalCorrect}`);
  console.log(`  ❌ Bị lọt: ${totalMissed}`);
  console.log(`  📊 Chính xác: ${(totalCorrect / Math.max(multiAppear.length, 1) * 100).toFixed(2)}%`);

  if (missedDetails.length > 0) {
    console.log(`\n${'─'.repeat(90)}`);
    console.log(`  CHI TIẾT CÁC NHÓM BỊ LỌT:`);
    console.log(`${'─'.repeat(90)}`);

    for (const { key, group, roots } of missedDetails) {
      console.log(`\n  🔴 ${key} — ${group.length} tin, ${roots} rootId`);
      
      // Group by rootId
      const byRoot = {};
      for (const g of group) {
        const r = g.rootId || `solo_${g.sourceId}`;
        if (!byRoot[r]) byRoot[r] = [];
        byRoot[r].push(g);
      }

      for (const [rootId, entries] of Object.entries(byRoot)) {
        console.log(`    ┌─ rootId=${rootId} (${entries.length} tin)`);
        for (const e of entries) {
          console.log(`    │ sid=${e.sourceId} | ${e.date} | prov="${e.province}"`);
          console.log(`    │   ${e.name}`);
        }
        console.log(`    └─`);
      }

      // Diagnosis
      const provinces = [...new Set(group.map(g => g.province).filter(Boolean))];
      if (provinces.length > 1) {
        console.log(`    ⚠️ Province khác nhau: [${provinces.join(' | ')}]`);
      }
      const hasEmpty = group.some(g => !g.province);
      if (hasEmpty) {
        console.log(`    ⚠️ Có tin THIẾU province`);
      }
    }
  }

  // Cũng liệt kê tin không rootId
  const noRootNotices = notices.filter(n => !n.rootId);
  if (noRootNotices.length > 0) {
    console.log(`\n${'─'.repeat(90)}`);
    console.log(`  TIN KHÔNG CÓ rootId (${noRootNotices.length} tin):`);
    console.log(`${'─'.repeat(90)}`);
    
    // Check which have AssetItem with identifiers
    let hasIdentifier = 0;
    let noIdentifier = 0;
    for (const n of noRootNotices) {
      const assetItems = items.filter(i => i.sourceId === n.sourceId);
      const hasPlot = assetItems.some(i => i.identifiers?.plotNumber);
      if (hasPlot) {
        hasIdentifier++;
      } else {
        noIdentifier++;
      }
    }
    console.log(`  Có plotNumber: ${hasIdentifier} (nên kiểm tra thêm)`);
    console.log(`  Không plotNumber: ${noIdentifier} (tin đơn lẻ, ok)`);

    // Show first few with plotNumber
    let shown = 0;
    for (const n of noRootNotices) {
      if (shown >= 10) break;
      const assetItems = items.filter(i => i.sourceId === n.sourceId);
      const hasPlot = assetItems.some(i => i.identifiers?.plotNumber);
      if (hasPlot) {
        const item = assetItems.find(i => i.identifiers?.plotNumber);
        const ids = item.identifiers;
        const key = `plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${(item.district || '?').toLowerCase().trim()}|w:${(item.ward || '?').toLowerCase().trim()}`;
        const matchCount = idGroups[key]?.length || 0;
        console.log(`  sid=${n.sourceId} | ${key} | matches=${matchCount}`);
        shown++;
      }
    }
  }

  await closeDB();
}

run().catch(console.error);
