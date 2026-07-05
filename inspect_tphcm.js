const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', { family: 4 }).then(async () => {
  try {
    // Find Duplicate by source ID 426469
    const dup = await Duplicate.findOne({ sourceIds: 426469 }).lean();
    console.log('Duplicate Doc for 426469:', JSON.stringify(dup, null, 2));
    
    if (dup) {
      console.log('Entries length:', dup.entries.length);
      console.log('Source IDs:', dup.sourceIds);
      
      // Let's also check the actual AuctionNotices for these sourceIds
      const notices = await AuctionNotice.find({ sourceId: { $in: dup.sourceIds } }).select('sourceId title publishRound publishedAt price').lean();
      console.log('AuctionNotices:', notices);
    } else {
      console.log('Not found in Duplicate! Searching in AuctionNotice...');
      const notice = await AuctionNotice.findOne({ sourceId: 426469 }).lean();
      console.log('Notice:', notice);
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
