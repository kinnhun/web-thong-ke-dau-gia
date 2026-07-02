const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');
const AuctionNotice = require('../src/models/AuctionNotice');
const AssetItem = require('../src/models/AssetItem');
const helpers = require('../src/utils/helpers');
const { extractAssetItemsFromNotice } = require('../src/scrapers/detail.scraper');

async function run() {
  console.log('Connecting to database...');
  await connectDB();
  console.log('Connected.');

  console.log('\n=========================================');
  console.log('TESTING CASE 1: CMTT PROPERTY (531787 vs 349164)');
  const noticeA = await AuctionNotice.findOne({ sourceId: 531787 }).lean();
  const noticeB = await AuctionNotice.findOne({ sourceId: 349164 }).lean();

  if (!noticeA || !noticeB) {
    console.error('Target CMTT notices not found in DB.');
  } else {
    const itemsA = extractAssetItemsFromNotice(noticeA, 'auction');
    const itemsB = extractAssetItemsFromNotice(noticeB, 'auction');

    console.log('Item A:', JSON.stringify(itemsA[0], null, 2));
    console.log('Item B:', JSON.stringify(itemsB[0], null, 2));

    const scoreRes = helpers.scoreAssetPair(itemsA[0], itemsB[0]);
    console.log('Matching Result CMTT:', scoreRes);
  }

  console.log('\n=========================================');
  console.log('TESTING CASE 2: DONG NAI VEHICLE (529730 vs 501389)');
  const noticeV1 = await AuctionNotice.findOne({ sourceId: 529730 }).lean();
  const noticeV2 = await AuctionNotice.findOne({ sourceId: 501389 }).lean();

  if (!noticeV1 || !noticeV2) {
    console.error('Target vehicle notices not found in DB.');
  } else {
    const itemsV1 = extractAssetItemsFromNotice(noticeV1, 'auction');
    const itemsV2 = extractAssetItemsFromNotice(noticeV2, 'auction');

    console.log('Vehicle 1 blocking keys:', itemsV1[0].blockingKeys);
    console.log('Vehicle 2 blocking keys:', itemsV2[0].blockingKeys);

    const scoreRes = helpers.scoreAssetPair(itemsV1[0], itemsV2[0]);
    console.log('Matching Result Vehicle:', scoreRes);
  }

  console.log('\n=========================================');
  console.log('TESTING CASE 3: NAM DINH KI-OT (363475 vs 328257)');
  const noticeK1 = await AuctionNotice.findOne({ sourceId: 363475 }).lean();
  const noticeK2 = await AuctionNotice.findOne({ sourceId: 328257 }).lean();

  if (!noticeK1 || !noticeK2) {
    console.error('Target ki-ốt notices not found in DB.');
  } else {
    const itemsK1 = extractAssetItemsFromNotice(noticeK1, 'auction');
    const itemsK2 = extractAssetItemsFromNotice(noticeK2, 'auction');

    console.log('Ki-ốt 1 area:', itemsK1[0].area);
    console.log('Ki-ốt 2 area:', itemsK2[0].area);

    const scoreRes = helpers.scoreAssetPair(itemsK1[0], itemsK2[0]);
    console.log('Matching Result Ki-ốt:', scoreRes);
  }

  await closeDB();
}

run().catch(console.error);
