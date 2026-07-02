const { MongoClient } = require('mongodb');
const helpers = require('../src/utils/helpers');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  // Case 1: Cách Mạng Tháng Tám property
  console.log('\n=========================================');
  console.log('CASE 1: CMTT PROPERTY (531787 vs 349164)');
  const noticeCM1 = await db.collection('auctionnotices').findOne({ sourceId: 531787 });
  const noticeCM2 = await db.collection('auctionnotices').findOne({ sourceId: 349164 });
  const idsCM1 = helpers.extractPropertyIdentifiers(noticeCM1.name);
  const idsCM2 = helpers.extractPropertyIdentifiers(noticeCM2.name);
  console.log('CMTT 1 Identifiers:', idsCM1);
  console.log('CMTT 2 Identifiers:', idsCM2);
  console.log('Has Conflict:', helpers.hasConflictingIdentifiers(idsCM1, idsCM2));

  // Case 2: Đồng Nai vehicle
  console.log('\n=========================================');
  console.log('CASE 2: DONG NAI VEHICLE (529730 vs 501389)');
  const noticeV1 = await db.collection('auctionnotices').findOne({ sourceId: 529730 });
  const noticeV2 = await db.collection('auctionnotices').findOne({ sourceId: 501389 });
  const idsV1 = helpers.extractPropertyIdentifiers(noticeV1.name);
  const idsV2 = helpers.extractPropertyIdentifiers(noticeV2.name);
  console.log('Vehicle 1 Identifiers:', idsV1);
  console.log('Vehicle 2 Identifiers:', idsV2);
  console.log('Has Conflict:', helpers.hasConflictingIdentifiers(idsV1, idsV2));

  // Case 3: Nam Định Ki-ốt
  console.log('\n=========================================');
  console.log('CASE 3: NAM DINH KI-OT (363475 vs 328257)');
  const noticeK1 = await db.collection('auctionnotices').findOne({ sourceId: 363475 });
  const noticeK2 = await db.collection('auctionnotices').findOne({ sourceId: 328257 });
  const idsK1 = helpers.extractPropertyIdentifiers(noticeK1.name);
  const idsK2 = helpers.extractPropertyIdentifiers(noticeK2.name);
  console.log('Ki-ốt 1 Identifiers:', idsK1);
  console.log('Ki-ốt 2 Identifiers:', idsK2);
  console.log('Has Conflict:', helpers.hasConflictingIdentifiers(idsK1, idsK2));

  // Case 4: Address Regex test for Phú Mỹ
  console.log('\n=========================================');
  console.log('CASE 4: DISTRICT PARSING FOR PHU MY (472128)');
  const noticePM = await db.collection('auctionnotices').findOne({ sourceId: 472128 });
  const idsPM = helpers.extractPropertyIdentifiers(noticePM.name);
  console.log('Phú Mỹ Identifiers:', idsPM);

  client.close();
}

run().catch(console.error);
