const mongoose = require('mongoose');
const AuctionNotice = require('../src/models/AuctionNotice');
const helpers = require('../src/utils/helpers');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const ids = [572451, 560931, 518415, 516986, 503357, 333259, 331723, 388876, 387459, 176246, 175306, 270309, 267975, 165387, 163980, 569814, 572310, 572311, 403446];
  const notices = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();
  
  console.log('--- Notice Titles ---');
  for (const id of ids) {
    const n = notices.find(x => x.sourceId === id);
    if (n) {
      console.log(`\nID: ${id}`);
      console.log(`Name: ${n.name}`);
      console.log(`RelatedIds:`, n.relatedIds);
      console.log(`Identifiers:`, helpers.extractPropertyIdentifiers(n.name));
    } else {
      console.log(`\nID ${id} NOT FOUND!`);
    }
  }

  await mongoose.connection.close();
}

run().catch(console.error);
