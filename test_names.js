const mongoose=require('mongoose');
const AuctionNotice=require('./bot-crawls-data/src/models/AuctionNotice');
const OrgSelection=require('./bot-crawls-data/src/models/OrgSelection');
mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  const items = await AuctionNotice.find({name:/Lê Quang Sung/i}).select('sourceId name').lean();
  const groups = {};
  items.forEach(i => {
    const n = i.name;
    if(!groups[n]) groups[n] = [];
    groups[n].push(i.sourceId);
  });
  console.log("== AUCTION NOTICES ==");
  for(let n in groups) {
    console.log(`[${groups[n].length}] "${n}"`);
  }

  const items2 = await OrgSelection.find({name:/Lê Quang Sung/i}).select('sourceId name').lean();
  const groups2 = {};
  items2.forEach(i => {
    const n = i.name;
    if(!groups2[n]) groups2[n] = [];
    groups2[n].push(i.sourceId);
  });
  console.log("== ORG SELECTIONS ==");
  for(let n in groups2) {
    console.log(`[${groups2[n].length}] "${n}"`);
  }
  process.exit(0);
}).catch(console.error);
