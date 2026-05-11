const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const { buildDuplicateEntries, summarizeDuplicateEntries } = require('./bot-crawls-data/src/scrapers/detail.scraper');

async function fixSpecificDuplicate() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  
  const ids = [382830, 414997].sort((a,b) => a - b);
  
  console.log('Building entries for', ids);
  const entries = await buildDuplicateEntries(ids, 'auction');
  const summary = summarizeDuplicateEntries(entries, 'auction');
  
  // Clean up any old duplicates for these ids
  await Duplicate.deleteMany({ sourceIds: { $in: ids } });
  
  const finalRootId = summary.rootId || ids[0];
  
  const newDup = new Duplicate({
    type: 'auction',
    sourceIds: ids,
    entries: entries,
    ...summary,
    rootId: finalRootId,
    organizer: 'Trung tâm Dịch vụ bán đấu giá tài sản TPHCM',
    province: 'TP. Hồ Chí Minh'
  });
  
  await newDup.save();
  console.log('Saved Duplicate group:', newDup._id);
  
  // Update AuctionNotices
  for (const entry of entries) {
    await AuctionNotice.updateOne(
      { sourceId: entry.sourceId },
      { 
        $set: { 
          publishRound: entry.publishRound,
          publishRoundLabel: entry.publishRoundLabel,
          rootId: finalRootId
        }
      }
    );
  }
  
  console.log('Done fixing.');
  await mongoose.disconnect();
}

fixSpecificDuplicate().catch(console.error);
