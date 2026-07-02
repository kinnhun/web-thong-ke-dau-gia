const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  const logs = await db.collection('crawllogs')
    .find({ type: 'duplicate_scan' })
    .sort({ startedAt: -1 })
    .limit(5)
    .toArray();

  logs.forEach(log => {
    console.log(`\n========================================`);
    console.log(`LOG ${log._id} | Status: ${log.status} | Started: ${log.startedAt}`);
    console.log(`Updated: ${log.itemsUpdated} | Skipped: ${log.itemsSkipped} | Pages: ${log.pagesProcessed}`);
    console.log(`Messages:`);
    if (log.errorMessages) {
      log.errorMessages.forEach(msg => console.log(`  - ${msg}`));
    }
  });

  client.close();
}

run().catch(console.error);
