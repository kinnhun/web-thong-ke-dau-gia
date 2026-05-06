require('dotenv').config({ path: './bot-crawls-data/.env' });
const mongoose = require('mongoose');
const { searchDuplicatesByFuzzyName } = require('../bot-crawls-data/src/scrapers/detail.scraper');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  try {
    const sourceId = 441901;
    const item = await AuctionNotice.findOne({ sourceId }).lean();
    console.log(`Searching duplicates for: [${sourceId}] ${item.name}`);
    
    const related = await searchDuplicatesByFuzzyName(sourceId, item.name, 'auction');
    console.log('Related IDs found:', related);
    
    const group2Ids = [472434, 491001, 507358, 522961, 536469, 550839];
    const foundGroup2 = group2Ids.filter(id => related.includes(id));
    
    console.log(`Found ${foundGroup2.length} out of ${group2Ids.length} from Group 2`);
    if (foundGroup2.length > 0) {
      console.log('Success! Items from Group 2 are now detected as duplicates.');
    } else {
      console.log('Failed. Group 2 items still not detected.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
