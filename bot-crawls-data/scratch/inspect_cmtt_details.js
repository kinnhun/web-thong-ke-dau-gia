const { MongoClient } = require('mongodb');
const helpers = require('../src/utils/helpers');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  const notices = await db.collection('auctionnotices')
    .find({ province: 'TP. Hồ Chí Minh', name: { $type: 'string', $ne: '' } })
    .project({ sourceId: 1, name: 1, province: 1 })
    .toArray();

  const cmttList = [];
  notices.forEach(n => {
    const ids = helpers.extractPropertyIdentifiers(n.name);
    if (ids.plotNumber === '22' && ids.mapSheet === '19') {
      cmttList.push({ sourceId: n.sourceId, name: n.name, ids });
    }
  });

  console.log(`Found ${cmttList.length} notices with plotNumber=22 and mapSheet=19 in TP. Hồ Chí Minh:`);
  cmttList.forEach((item, idx) => {
    console.log(`[${idx}] ${item.sourceId}: ${item.name}`);
  });

  client.close();
}

run().catch(console.error);
