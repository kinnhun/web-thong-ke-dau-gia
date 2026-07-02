const { MongoClient } = require('mongodb');
const helpers = require('../src/utils/helpers');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  const ids = [531787, 349164];
  const notices = await db.collection('auctionnotices')
    .find({ sourceId: { $in: ids } })
    .toArray();

  const n531787 = notices.find(n => n.sourceId === 531787);
  const n349164 = notices.find(n => n.sourceId === 349164);

  const ids531787 = helpers.extractPropertyIdentifiers(n531787.name);
  const ids349164 = helpers.extractPropertyIdentifiers(n349164.name);

  console.log('Identifiers 531787:', ids531787);
  console.log('Identifiers 349164:', ids349164);

  console.log('Has Conflict:', helpers.hasConflictingIdentifiers(ids531787, ids349164));
  console.log('Is Strong Match:', helpers.hasMatchingStrongIdentifiers(ids531787, ids349164));

  const core531787 = helpers.extractCoreIdentity(n531787.name);
  const core349164 = helpers.extractCoreIdentity(n349164.name);
  const bg531787 = helpers.getBigrams(core531787);
  const bg349164 = helpers.getBigrams(core349164);
  const sim = helpers.jaccardSimilarity(bg531787, bg349164);
  const ov = helpers.overlapSimilarity(bg531787, bg349164);

  console.log('Core 531787:', core531787);
  console.log('Core 349164:', core349164);
  console.log('Jaccard similarity:', sim);
  console.log('Overlap similarity:', ov);

  client.close();
}

run().catch(console.error);
