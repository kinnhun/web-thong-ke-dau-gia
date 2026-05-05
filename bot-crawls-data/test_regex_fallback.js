const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia').then(async () => {
  const AuctionNotice = require('./src/models/AuctionNotice');
  const targetNumbers = ['490', '3', '6'];
  const regexQueries = targetNumbers.map(num => ({ name: { $regex: "(^|\\s)" + num + "(\\s|$|\\.|,|\\))", $options: 'i' } }));
  const regexDbQuery = { $and: regexQueries };
  
  const dbCandidatesRegex = await AuctionNotice.find(regexDbQuery)
        .limit(150)
        .select('sourceId name')
        .lean();
  console.log('Total found:', dbCandidatesRegex.length);
  const ids = dbCandidatesRegex.map(r => r.sourceId);
  console.log('Includes 412766?', ids.includes(412766));
  console.log('Includes 562918?', ids.includes(562918));
  mongoose.disconnect();
}).catch(console.error);
