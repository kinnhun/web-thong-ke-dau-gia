/**
 * Debug: Tại sao 2 nhóm cuối không được Phase 1 merge?
 */
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const Duplicate = require('../src/models/Duplicate');

async function run() {
  await connectDB();

  // Check Duplicate records cho 2 case
  const testSourceIds = [475441, 154573, 311988, 300756];

  for (const sid of testSourceIds) {
    const dup = await Duplicate.findOne({ type: 'auction', sourceIds: sid }).lean();
    if (!dup) { console.log(`sid=${sid}: NO DUPLICATE RECORD`); continue; }

    const item = await AssetItem.findOne({ sourceId: sid, sourceType: 'auction' })
      .select('sourceId identifiers district ward province').lean();

    const notice = await AuctionNotice.findOne({ sourceId: sid })
      .select('sourceId organizer').lean();
    const org = notice?.organizer || '';
    const orgSlug = org.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '');

    const ids = item?.identifiers || {};
    const key = ids.plotNumber ? [
      `p:${ids.plotNumber}`,
      `s:${ids.mapSheet || '?'}`,
      `d:${(item.district || '?').toLowerCase().trim()}`,
      `w:${(item.ward || '?').toLowerCase().trim()}`,
    ].join('|') : 'NO_PLOT';

    const fullKey = `${key}|org:${orgSlug}`;

    console.log(`sid=${sid}:`);
    console.log(`  dup._id=${dup._id} rootId=${dup.rootId} sourceIds=[${dup.sourceIds.join(',')}]`);
    console.log(`  item.plot=${ids.plotNumber} sheet=${ids.mapSheet} district="${item?.district}" ward="${item?.ward}" province="${item?.province}"`);
    console.log(`  org_slug="${orgSlug}"`);
    console.log(`  fullKey="${fullKey}"`);
    console.log();
  }

  await closeDB();
}

run().catch(console.error);
