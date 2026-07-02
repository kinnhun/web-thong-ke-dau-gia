const { MongoClient } = require('mongodb');
const helpers = require('../src/utils/helpers');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  console.log('Fetching notices of TP. Hồ Chí Minh...');
  const notices = await db.collection('auctionnotices')
    .find({ province: 'TP. Hồ Chí Minh', name: { $type: 'string', $ne: '' } })
    .project({ sourceId: 1, name: 1, province: 1 })
    .toArray();

  console.log(`Fetched ${notices.length} notices.`);

  const data = notices.map((n, i) => {
    return {
      index: i,
      sourceId: n.sourceId,
      name: n.name,
      identifiers: helpers.extractPropertyIdentifiers(n.name)
    };
  });

  const strongMap = new Map();
  for (let i = 0; i < data.length; i++) {
    const ids = data[i].identifiers;
    if (ids.plotNumber && ids.mapSheet) {
      const hash = 'land:' + ids.plotNumber + ':' + ids.mapSheet;
      if (!strongMap.has(hash)) strongMap.set(hash, []);
      strongMap.get(hash).push(i);
    }
  }

  console.log('\nAnalyzing land strong map buckets:');
  const cmttBucket = strongMap.get('land:22:19');
  if (cmttBucket) {
    console.log(`\nBucket land:22:19 has ${cmttBucket.length} items:`);
    cmttBucket.forEach(idx => {
      const item = data[idx];
      console.log(`  - [${item.sourceId}] ${item.name}`);
      console.log(`    Identifiers:`, JSON.stringify(item.identifiers));
    });

    // Check conflicts between all pairs in the bucket
    console.log('\nChecking conflicts in land:22:19:');
    for (let k = 0; k < cmttBucket.length; k++) {
      for (let m = k + 1; m < cmttBucket.length; m++) {
        const itemA = data[cmttBucket[k]];
        const itemB = data[cmttBucket[m]];
        const conflict = helpers.hasConflictingIdentifiers(itemA.identifiers, itemB.identifiers);
        console.log(`  - ${itemA.sourceId} vs ${itemB.sourceId}: Conflict = ${conflict}`);
      }
    }
  } else {
    console.log('No items in land:22:19 strong map bucket!');
  }

  client.close();
}

run().catch(console.error);
