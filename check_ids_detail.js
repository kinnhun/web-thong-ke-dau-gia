const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const AssetItem = require('./bot-crawls-data/src/models/AssetItem');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    const sourceId = 285496;
    
    // Find AuctionNotice
    const notice = await AuctionNotice.findOne({ sourceId }).lean();
    console.log('AuctionNotice:', {
      _id: notice?._id,
      sourceId: notice?.sourceId,
      name: notice?.name,
      initialPrice: notice?.initialPrice,
      publishedAt: notice?.publishedAt
    });

    // Find AssetItem
    const assetItems = await AssetItem.find({ sourceId }).lean();
    console.log(`AssetItems (${assetItems.length}):`);
    assetItems.forEach((item, idx) => {
      console.log(`Item #${idx}:`, {
        _id: item._id,
        noticeId: item.noticeId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        itemIndex: item.itemIndex,
        name: item.name,
        startingPrice: item.startingPrice
      });
    });

    // Let's also check if there is an AssetItem pointing to the notice._id
    if (notice) {
      const itemsByNoticeId = await AssetItem.find({ noticeId: notice._id }).lean();
      console.log(`AssetItems by noticeId (${itemsByNoticeId.length}):`);
      itemsByNoticeId.forEach((item, idx) => {
        console.log(`Item #${idx}:`, {
          _id: item._id,
          name: item.name,
          sourceId: item.sourceId,
          sourceType: item.sourceType
        });
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
