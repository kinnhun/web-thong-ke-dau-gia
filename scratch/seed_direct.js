const mongoose = require('mongoose');
const https = require('https');
const AuctionNotice = require('../bot-crawls-data/src/models/AuctionNotice');

const targetIds = [566731, 241186, 268652, 466453, 566714];
const prodUrl = 'https://inspiration-pike-marketing-sodium.trycloudflare.com';

mongoose.set('debug', true);

function fetchProductionAuction(id) {
  return new Promise((resolve, reject) => {
    console.log(`Fetching ID #${id} from production...`);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(`${prodUrl}/api/auctions/${id}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to fetch ID #${id}: HTTP ${res.statusCode}`));
        }
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Connecting to local MongoDB (127.0.0.1)...');
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia', {
    serverSelectionTimeoutMS: 5000
  });
  console.log('✅ Connected to local MongoDB');

  console.log('Clearing local AuctionNotice collection...');
  const delStart = Date.now();
  await AuctionNotice.deleteMany({});
  console.log(`Cleared local AuctionNotice collection in ${Date.now() - delStart} ms.`);

  for (const id of targetIds) {
    try {
      const data = await fetchProductionAuction(id);
      if (data && data.sourceId) {
        // Strip mongodb specific fields before inserting
        delete data._id;
        delete data.__v;
        
        await AuctionNotice.create(data);
        console.log(`✅ Successfully seeded ID #${id}: "${data.name.slice(0, 50)}..."`);
      }
    } catch (err) {
      console.error(`❌ Error seeding ID #${id}:`, err.message);
    }
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 1000));
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

run().catch(console.error);
