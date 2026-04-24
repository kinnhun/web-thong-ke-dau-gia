require('dotenv').config();
const mongoose = require('mongoose');
const { fetchAPI } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const { slugify } = require('../utils/helpers');

async function testMultiAsset() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thong_ke_dau_gia');
  console.log('Connected');
  
  const sourceId = 560714;
  const json = await fetchAPI('/portal/propertyInfo', { auctionInfoId: sourceId });
  console.log('Items count:', json.items?.length);
  
  if (json.items && json.items.length > 1) {
    const properties = json.items.map((p, i) => {
      console.log(`[${i+1}] ${p.propertyName || p.propertyDesc}: ${p.propertyStartPrice} VND`);
      return {
        name: p.propertyName || p.propertyDesc || '',
        amount: p.propertyAmount || '01',
        startPrice: p.propertyStartPrice || 0,
        deposit: p.deposit || 0,
        place: p.propertyPlace || '',
        quality: p.propertyQuality || '',
      };
    });
    
    const totalPrice = properties.reduce((s, p) => s + (p.startPrice || 0), 0);
    console.log('Total price:', totalPrice);
    
    // Update in DB
    await AuctionNotice.updateOne(
      { sourceId },
      { $set: { properties, initialPrice: totalPrice, currentPrice: totalPrice, detailScraped: true } }
    );
    console.log('Updated item', sourceId, 'with', properties.length, 'properties');
  }
  
  await mongoose.disconnect();
  process.exit(0);
}

testMultiAsset().catch(e => { console.error(e); process.exit(1); });
