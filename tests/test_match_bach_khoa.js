const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const AssetItem = require('./bot-crawls-data/src/models/AssetItem');
const { scoreAssetPair, detectHardConflict } = require('./bot-crawls-data/src/utils/helpers');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const idA = 285496;
    const idB = 287574;

    // Find their AssetItems
    const itemsA = await AssetItem.find({ sourceId: idA }).lean();
    const itemsB = await AssetItem.find({ sourceId: idB }).lean();

    console.log(`AssetItems for ${idA}:`, itemsA.length);
    console.log(`AssetItems for ${idB}:`, itemsB.length);

    if (itemsA.length > 0 && itemsB.length > 0) {
      const a = itemsA[0];
      const b = itemsB[0];

      console.log('Asset A details:');
      console.log(`- name: "${a.name}"`);
      console.log(`- startingPrice: ${a.startingPrice}`);
      console.log(`- area: ${a.area}`);
      console.log(`- identifiers:`, a.identifiers);
      console.log(`- coreIdentity: "${a.coreIdentity}"`);
      console.log(`- assetType: "${a.assetType}"`);

      console.log('\nAsset B details:');
      console.log(`- name: "${b.name}"`);
      console.log(`- startingPrice: ${b.startingPrice}`);
      console.log(`- area: ${b.area}`);
      console.log(`- identifiers:`, b.identifiers);
      console.log(`- coreIdentity: "${b.coreIdentity}"`);
      console.log(`- assetType: "${b.assetType}"`);

      console.log('\n--- Evaluating scoreAssetPair ---');
      const conflict = detectHardConflict(a, b);
      console.log('detectHardConflict:', conflict);
      
      const scoreResult = scoreAssetPair(a, b);
      console.log('scoreAssetPair result:', scoreResult);
    } else {
      console.log('No AssetItem found. Did they get extracted?');
      
      // Let's check notices directly
      const noticeA = await AuctionNotice.findOne({ sourceId: idA }).lean();
      const noticeB = await AuctionNotice.findOne({ sourceId: idB }).lean();
      
      console.log(`Notice ${idA} exists:`, !!noticeA);
      console.log(`Notice ${idB} exists:`, !!noticeB);
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
