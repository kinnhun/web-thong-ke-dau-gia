const mongoose = require('mongoose');

async function run() {
  console.log('Connecting to local MongoDB (127.0.0.1)...');
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  console.log('Connected!');

  const collections = ['auctionnotices', 'orgselections', 'statcaches', 'duplicates'];
  
  for (const name of collections) {
    try {
      console.log(`Dropping collection: ${name}...`);
      await mongoose.connection.db.dropCollection(name);
      console.log(`Dropped ${name}.`);
    } catch (e) {
      if (e.codeName === 'NamespaceNotFound') {
        console.log(`Collection ${name} does not exist, skipping.`);
      } else {
        console.error(`Error dropping ${name}:`, e.message);
      }
    }
  }

  await mongoose.disconnect();
  console.log('Disconnected!');
}

run().catch(console.error);
