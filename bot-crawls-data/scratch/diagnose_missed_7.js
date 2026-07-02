/**
 * Phân tích chi tiết 7 nhóm còn bị lọt sau Phase 1 + 2
 */
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

const MISSED_KEYS = [
  { plot: '648', sheet: '17', district: 'hoc mon', ward: 'tan hiep' },
  { plot: '28', sheet: '70', district: 'cu chi', ward: 'tan an hoi' },
  { plot: '24', sheet: '65', district: 'tan phu', ward: 'phu tho hoa' },
  { plot: '237', sheet: '69', district: 'cu chi', ward: 'tan an hoi' },
  { plot: '240', sheet: '69', district: 'cu chi', ward: 'tan an hoi' },
  { plot: '29', sheet: '70', district: 'cu chi', ward: 'tan an hoi' },
  { plot: '36', sheet: '70', district: 'cu chi', ward: 'tan an hoi' },
];

async function run() {
  await connectDB();

  const orgName = /trung.*t[aâ]m.*d[iị]ch.*v[uụ].*b[aá]n.*đ[aấ]u.*gi[aá].*t[aà]i.*s[aả]n.*t(p|hcm|phcm)/i;
  const notices = await AuctionNotice.find({ organizer: orgName })
    .select('sourceId name rootId organizer publishedAt relatedIds')
    .lean();
  const noticeMap = {};
  for (const n of notices) noticeMap[n.sourceId] = n;

  const sourceIds = notices.map(n => n.sourceId);
  const items = await AssetItem.find({ sourceId: { $in: sourceIds }, sourceType: 'auction' })
    .select('sourceId identifiers district ward assetType province name')
    .lean();

  // Group items by sourceId
  const itemsBySource = {};
  for (const item of items) {
    if (!itemsBySource[item.sourceId]) itemsBySource[item.sourceId] = [];
    itemsBySource[item.sourceId].push(item);
  }

  // Get all duplicates
  const dups = await Duplicate.find({ type: 'auction' }).lean();
  const dupBySourceId = {};
  for (const d of dups) {
    for (const sid of d.sourceIds) dupBySourceId[sid] = d;
  }

  for (const mk of MISSED_KEYS) {
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`║ plot:${mk.plot} | sheet:${mk.sheet} | d:${mk.district} | w:${mk.ward}`);
    console.log(`${'═'.repeat(90)}`);

    // Find matching items
    const matching = items.filter(item => {
      const ids = item.identifiers || {};
      const d = (item.district || '').toLowerCase().trim();
      const w = (item.ward || '').toLowerCase().trim();
      return ids.plotNumber === mk.plot &&
        ids.mapSheet === mk.sheet &&
        d.includes(mk.district) &&
        w.includes(mk.ward);
    });

    // Group by rootId
    const byRoot = {};
    for (const item of matching) {
      const notice = noticeMap[item.sourceId];
      const rootId = notice?.rootId || `solo_${item.sourceId}`;
      if (!byRoot[rootId]) byRoot[rootId] = [];
      byRoot[rootId].push({ item, notice });
    }

    console.log(`Tổng tin: ${matching.length} | Số rootId: ${Object.keys(byRoot).length}`);

    for (const [rootId, entries] of Object.entries(byRoot)) {
      const dup = dupBySourceId[entries[0].item.sourceId];
      const dupId = dup?._id?.toString().slice(-8) || 'N/A';
      
      console.log(`\n  ┌─ RootId: ${rootId} (${entries.length} tin) | Dup: ...${dupId}`);
      
      for (const { item, notice } of entries) {
        const org = notice?.organizer || '';
        const orgSlug = org.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
        const date = notice?.publishedAt ? new Date(notice.publishedAt).toISOString().slice(0, 10) : '?';
        const related = notice?.relatedIds || [];
        const inDup = dup ? dup.sourceIds.includes(item.sourceId) : false;
        
        console.log(`  │ sourceId=${item.sourceId} | ${date} | related=[${related.join(',')}] | inDup=${inDup}`);
        console.log(`  │   org_slug="${orgSlug}"`);
        console.log(`  │   name: ${item.name?.substring(0, 100) || notice?.name?.substring(0, 100)}`);
        console.log(`  │   district="${item.district}" ward="${item.ward}" province="${item.province}"`);
      }
      console.log(`  └─`);
    }

    // Diagnose why not merged
    const rootIds = Object.keys(byRoot);
    if (rootIds.length > 1) {
      console.log(`\n  🔍 DIAGNOSIS:`);
      
      // Check if orgSlug matches
      const orgSlugs = new Set();
      for (const entries of Object.values(byRoot)) {
        for (const { notice } of entries) {
          const org = notice?.organizer || '';
          const slug = org.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');
          orgSlugs.add(slug);
        }
      }
      
      if (orgSlugs.size > 1) {
        console.log(`  ⚠️ Khác organizer slug: [${[...orgSlugs].join(', ')}]`);
      } else {
        console.log(`  ✓ Cùng organizer slug: "${[...orgSlugs][0]}"`);
      }

      // Check if items are in Duplicate records
      const inDupCount = matching.filter(item => dupBySourceId[item.sourceId]).length;
      const notInDup = matching.filter(item => !dupBySourceId[item.sourceId]);
      console.log(`  In Duplicate: ${inDupCount}/${matching.length}`);
      if (notInDup.length > 0) {
        console.log(`  ⚠️ NOT in Duplicate: sourceIds=[${notInDup.map(i => i.sourceId).join(', ')}]`);
      }

      // Check if any are in the SAME Duplicate record  
      const dupIds = new Set();
      for (const item of matching) {
        const d = dupBySourceId[item.sourceId];
        if (d) dupIds.add(d._id.toString());
      }
      console.log(`  Distinct Duplicate records: ${dupIds.size}`);
    }
  }

  await closeDB();
}

run().catch(console.error);
