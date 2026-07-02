/**
 * Fix 2 nhóm cuối: Merge trực tiếp các Duplicate records bị lọt
 * do province rỗng/sai khi identifier key trùng 100%
 */
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

async function run() {
  await connectDB();

  // Case 1: plot:648|sheet:17|d:hoc mon|w:tan hiep
  // rootId=41207 (10 tin, prov="TP. HCM") và rootId=154573 (6 tin, prov="")
  console.log('\n=== Case 1: Hóc Môn plot:648 ===');
  
  const dup1A = await Duplicate.findOne({ type: 'auction', sourceIds: 475441 }); // rootId 41207
  const dup1B = await Duplicate.findOne({ type: 'auction', sourceIds: 154573 }); // rootId 154573
  
  if (dup1A && dup1B && dup1A._id.toString() !== dup1B._id.toString()) {
    console.log(`  Dup A: rootId=${dup1A.rootId}, sourceIds=${dup1A.sourceIds.length}`);
    console.log(`  Dup B: rootId=${dup1B.rootId}, sourceIds=${dup1B.sourceIds.length}`);
    
    // Merge B vào A (giữ rootId nhỏ hơn)
    const keeper = dup1A.rootId < dup1B.rootId ? dup1A : dup1B;
    const loser = dup1A.rootId < dup1B.rootId ? dup1B : dup1A;
    
    const mergedIds = [...new Set([...keeper.sourceIds, ...loser.sourceIds])].sort((a, b) => a - b);
    await Duplicate.updateOne({ _id: keeper._id }, { $set: { sourceIds: mergedIds } });
    await Duplicate.deleteOne({ _id: loser._id });
    
    // Update rootId cho tất cả notices
    for (const sid of mergedIds) {
      await AuctionNotice.updateOne({ sourceId: sid }, { $set: { rootId: keeper.rootId } });
    }
    console.log(`  ✅ Merged: rootId=${keeper.rootId}, total sourceIds=${mergedIds.length}`);
  } else if (dup1A && dup1B) {
    console.log('  Already merged!');
  } else {
    console.log(`  ⚠️ Dup not found: A=${!!dup1A}, B=${!!dup1B}`);
  }

  // Case 2: plot:24|sheet:65|d:tan phu|w:phu tho hoa
  // rootId=190987 (2 tin, prov="Phú Thọ") và rootId=300756 (3 tin, prov="TP. HCM")
  console.log('\n=== Case 2: Tân Phú plot:24 ===');
  
  const dup2A = await Duplicate.findOne({ type: 'auction', sourceIds: 311988 }); // rootId 190987 
  const dup2B = await Duplicate.findOne({ type: 'auction', sourceIds: 300756 }); // rootId 300756
  
  if (dup2A && dup2B && dup2A._id.toString() !== dup2B._id.toString()) {
    console.log(`  Dup A: rootId=${dup2A.rootId}, sourceIds=${dup2A.sourceIds.length}`);
    console.log(`  Dup B: rootId=${dup2B.rootId}, sourceIds=${dup2B.sourceIds.length}`);
    
    const keeper = dup2A.rootId < dup2B.rootId ? dup2A : dup2B;
    const loser = dup2A.rootId < dup2B.rootId ? dup2B : dup2A;
    
    const mergedIds = [...new Set([...keeper.sourceIds, ...loser.sourceIds])].sort((a, b) => a - b);
    await Duplicate.updateOne({ _id: keeper._id }, { $set: { sourceIds: mergedIds } });
    await Duplicate.deleteOne({ _id: loser._id });
    
    for (const sid of mergedIds) {
      await AuctionNotice.updateOne({ sourceId: sid }, { $set: { rootId: keeper.rootId } });
    }
    console.log(`  ✅ Merged: rootId=${keeper.rootId}, total sourceIds=${mergedIds.length}`);
  } else if (dup2A && dup2B) {
    console.log('  Already merged!');
  } else {
    console.log(`  ⚠️ Dup not found: A=${!!dup2A}, B=${!!dup2B}`);
  }

  // Verify
  console.log('\n=== VERIFY ===');
  const orgName = /trung.*t[aâ]m.*d[iị]ch.*v[uụ].*b[aá]n.*đ[aấ]u.*gi[aá].*t[aà]i.*s[aả]n.*t(p|hcm|phcm)/i;
  const notices = await AuctionNotice.find({ organizer: orgName }).select('sourceId rootId').lean();
  const sourceIds = notices.map(n => n.sourceId);
  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' })
    .select('sourceId identifiers district ward').lean();

  const idGroups = {};
  for (const item of items) {
    const ids = item.identifiers || {};
    if (!ids.plotNumber) continue;
    const key = `plot:${ids.plotNumber}|sheet:${ids.mapSheet || '?'}|d:${(item.district || '?').toLowerCase().trim()}|w:${(item.ward || '?').toLowerCase().trim()}`;
    if (!idGroups[key]) idGroups[key] = [];
    const n = notices.find(n => n.sourceId === item.sourceId);
    idGroups[key].push({ sourceId: item.sourceId, rootId: n?.rootId || null });
  }

  const multi = Object.entries(idGroups).filter(([k, v]) => v.length >= 2);
  let missed = 0;
  for (const [key, group] of multi) {
    const roots = [...new Set(group.map(g => g.rootId || `solo_${g.sourceId}`))];
    if (roots.length > 1) { missed++; console.log(`  ❌ ${key}: ${group.length} tin, ${roots.length} rootId`); }
  }

  const correct = multi.length - missed;
  console.log(`\n  Tổng tài sản (>=2 tin): ${multi.length}`);
  console.log(`  ✅ Gom đúng: ${correct}`);
  console.log(`  ❌ Bị lọt: ${missed}`);
  console.log(`  📊 Chính xác: ${(correct / Math.max(multi.length, 1) * 100).toFixed(2)}%`);

  await closeDB();
}

run().catch(console.error);
