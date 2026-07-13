const mongoose = require('mongoose');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');
const OrgSelection = require('./bot-crawls-data/src/models/OrgSelection');

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  console.log('Populating province and organizer for Duplicate records...');
  const dups = await Duplicate.find({});
  let updated = 0;
  for (const dup of dups) {
    if (!dup.sourceIds || dup.sourceIds.length === 0) continue;
    
    const Model = dup.type === 'org' ? OrgSelection : AuctionNotice;
    const dbItems = await Model.find({ sourceId: { $in: dup.sourceIds } }).select('province organizer').lean();
    
    const prov = dbItems.find(i => i.province)?.province;
    const org = dbItems.find(i => i.organizer)?.organizer;
    
    let isChanged = false;
    if (prov && dup.province !== prov) { dup.province = prov; isChanged = true; }
    if (org && dup.organizer !== org) { dup.organizer = org; isChanged = true; }
    
    if (isChanged) {
      await dup.save();
      updated++;
    }
  }
  console.log(`Successfully updated ${updated} Duplicate records.`);
  process.exit(0);
}).catch(console.error);
