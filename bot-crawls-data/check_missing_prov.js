const mongoose = require('mongoose');
const config = require('./src/config');
const AuctionNotice = require('./src/models/AuctionNotice');

async function check() {
  await mongoose.connect(config.mongo.uri);
  const count = await AuctionNotice.countDocuments({ 
    $or: [
      { province: null }, 
      { province: '' },
      { province: { $exists: false } }
    ] 
  });
  console.log('Empty/Null province count:', count);
  
  const sample = await AuctionNotice.find({ 
    $or: [{ province: null }, { province: '' }] 
  }).limit(5).select('name organizer province').lean();
  console.log('Sample missing province:', JSON.stringify(sample, null, 2));
  
  process.exit(0);
}

check().catch(console.error);
