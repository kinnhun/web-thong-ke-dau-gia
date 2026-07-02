const { MongoClient } = require('mongodb');
const helpers = require('../src/utils/helpers');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  console.log('Fetching all AuctionNotices...');
  const notices = await db.collection('auctionnotices')
    .find({ name: { $type: 'string', $ne: '' } })
    .project({ sourceId: 1, name: 1, province: 1 })
    .toArray();

  console.log(`Fetched ${notices.length} notices.`);

  console.log('Fetching all Duplicates...');
  const duplicates = await db.collection('duplicates')
    .find({ type: 'auction' })
    .project({ sourceIds: 1 })
    .toArray();

  console.log(`Fetched ${duplicates.length} duplicates.`);

  // Create a map from sourceId to its duplicate group ID (or object)
  const dupMap = new Map();
  duplicates.forEach(d => {
    if (d.sourceIds) {
      d.sourceIds.forEach(sid => {
        dupMap.set(sid, d._id.toString());
      });
    }
  });

  // Let's parse identifiers for all notices
  console.log('Parsing identifiers for all notices...');
  const parsedNotices = [];
  for (let i = 0; i < notices.length; i++) {
    const n = notices[i];
    const ids = helpers.extractPropertyIdentifiers(n.name);
    parsedNotices.push({
      sourceId: n.sourceId,
      name: n.name,
      province: n.province,
      ids
    });
    if (i > 0 && i % 100000 === 0) {
      console.log(`Parsed ${i} notices...`);
    }
  }

  // Now, let's group by licensePlate
  console.log('Checking for unmapped items by licensePlate...');
  const plateGroups = {};
  parsedNotices.forEach(n => {
    if (n.ids.licensePlate) {
      const key = `${n.province || ''}_${n.ids.licensePlate}`;
      if (!plateGroups[key]) plateGroups[key] = [];
      plateGroups[key].push(n);
    }
  });

  let plateUnmappedCount = 0;
  for (const [key, list] of Object.entries(plateGroups)) {
    if (list.length >= 2) {
      // Check if they are in different duplicate groups or not in any group
      const groups = new Set(list.map(n => dupMap.get(n.sourceId) || 'none'));
      if (groups.size > 1) {
        console.log(`\n⚠️ Mismatched License Plate Group: ${key}`);
        list.forEach(n => {
          console.log(`  - [${n.sourceId}] ${n.name} (Dup Group: ${dupMap.get(n.sourceId) || 'None'})`);
          console.log(`    Identifiers:`, JSON.stringify(n.ids));
        });
        plateUnmappedCount++;
        if (plateUnmappedCount >= 5) break;
      }
    }
  }

  // Group by plotNumber + mapSheet
  console.log('\nChecking for unmapped items by plotNumber + mapSheet...');
  const landGroups = {};
  parsedNotices.forEach(n => {
    if (n.ids.plotNumber && n.ids.mapSheet) {
      const key = `${n.province || ''}_${n.ids.plotNumber}_${n.ids.mapSheet}`;
      if (!landGroups[key]) landGroups[key] = [];
      landGroups[key].push(n);
    }
  });

  let landUnmappedCount = 0;
  for (const [key, list] of Object.entries(landGroups)) {
    if (list.length >= 2) {
      const groups = new Set(list.map(n => dupMap.get(n.sourceId) || 'none'));
      if (groups.size > 1) {
        console.log(`\n⚠️ Mismatched Land Group (Thửa/Tờ): ${key}`);
        list.forEach(n => {
          console.log(`  - [${n.sourceId}] ${n.name} (Dup Group: ${dupMap.get(n.sourceId) || 'None'})`);
          console.log(`    Identifiers:`, JSON.stringify(n.ids));
        });
        landUnmappedCount++;
        if (landUnmappedCount >= 5) break;
      }
    }
  }

  // Group by houseNumber + street
  console.log('\nChecking for unmapped items by houseNumber + street...');
  const houseGroups = {};
  parsedNotices.forEach(n => {
    if (n.ids.houseNumber) {
      // Extract street address from core identity or name
      const core = helpers.extractCoreIdentity(n.name);
      // Look for streets
      const streetMatch = core.match(/\b(le van huu|nguyen van cu|cach mang thang tam|tran hung dao|le loi|nguyen hue|hai ba trung|le duan)\b/i);
      if (streetMatch) {
        const key = `${n.province || ''}_${n.ids.houseNumber}_${streetMatch[1]}`;
        if (!houseGroups[key]) houseGroups[key] = [];
        houseGroups[key].push(n);
      }
    }
  });

  let houseUnmappedCount = 0;
  for (const [key, list] of Object.entries(houseGroups)) {
    if (list.length >= 2) {
      const groups = new Set(list.map(n => dupMap.get(n.sourceId) || 'none'));
      if (groups.size > 1) {
        console.log(`\n⚠️ Mismatched House Group: ${key}`);
        list.forEach(n => {
          console.log(`  - [${n.sourceId}] ${n.name} (Dup Group: ${dupMap.get(n.sourceId) || 'None'})`);
          console.log(`    Identifiers:`, JSON.stringify(n.ids));
        });
        houseUnmappedCount++;
        if (houseUnmappedCount >= 5) break;
      }
    }
  }

  client.close();
}

run().catch(console.error);
