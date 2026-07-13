const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Disable automatic index compilation upon model compilation.
// We will manually trigger index builds after importing all documents.
mongoose.set('autoIndex', false);

const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/stream-array.js');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/thong_ke_dau_gia';
const SOURCE_DIR = 'E:\\Neuer Ordner';

// Import Mongoose models so we can rebuild indexes
const AssetItem = require('./src/models/AssetItem');
const AuctionNotice = require('./src/models/AuctionNotice');
const Duplicate = require('./src/models/Duplicate');
const OrgSelection = require('./src/models/OrgSelection');
const PotentialDuplicate = require('./src/models/PotentialDuplicate');
const StatCache = require('./src/models/StatCache');

const COLLECTIONS = [
  { file: 'thong_ke_dau_gia.statcaches.json', name: 'statcaches', model: StatCache },
  { file: 'thong_ke_dau_gia.orgselections.json', name: 'orgselections', model: OrgSelection },
  { file: 'thong_ke_dau_gia.duplicates.json', name: 'duplicates', model: Duplicate },
  { file: 'thong_ke_dau_gia.potentialduplicates.json', name: 'potentialduplicates', model: PotentialDuplicate },
  { file: 'thong_ke_dau_gia.assetitems.json', name: 'assetitems', model: AssetItem },
  { file: 'thong_ke_dau_gia.auctionnotices.json', name: 'auctionnotices', model: AuctionNotice },
];

function convertExtendedJson(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(convertExtendedJson);
  }

  // Handle $oid
  if (obj.$oid) {
    try {
      return new mongoose.Types.ObjectId(obj.$oid);
    } catch(e) {
      return obj.$oid;
    }
  }

  // Handle $date
  if (obj.$date) {
    if (typeof obj.$date === 'string') return new Date(obj.$date);
    if (typeof obj.$date === 'number') return new Date(obj.$date);
    if (obj.$date.$numberLong) return new Date(parseInt(obj.$date.$numberLong));
    return obj.$date;
  }
  
  // Handle $numberDouble, $numberInt, $numberLong, $numberDecimal
  if (obj.$numberDouble) return parseFloat(obj.$numberDouble);
  if (obj.$numberInt) return parseInt(obj.$numberInt, 10);
  if (obj.$numberLong) return parseInt(obj.$numberLong, 10);
  if (obj.$numberDecimal) return parseFloat(obj.$numberDecimal);

  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = convertExtendedJson(obj[key]);
  }
  return result;
}

async function importCollection(colInfo) {
  const filePath = path.join(SOURCE_DIR, colInfo.file);
  const colName = colInfo.name;
  const Model = colInfo.model;

  console.log(`\n==================================================`);
  console.log(`Starting import for collection: "${colName}"`);
  console.log(`Source file: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    return;
  }

  // 1. Drop existing collection
  console.log(`Dropping existing collection "${colName}" if it exists...`);
  await mongoose.connection.db.dropCollection(colName).catch(err => {
    console.log(`Collection "${colName}" did not exist or could not be dropped. Continuing...`);
  });

  const collection = mongoose.connection.db.collection(colName);
  let batch = [];
  const BATCH_SIZE = 2000;
  let count = 0;

  return new Promise((resolve, reject) => {
    const pipeline = fs.createReadStream(filePath)
      .pipe(streamArray.withParserAsStream());

    pipeline.on('data', async (data) => {
      let doc = data.value;
      doc = convertExtendedJson(doc);
      batch.push(doc);

      if (batch.length >= BATCH_SIZE) {
        pipeline.pause();
        try {
          await collection.insertMany(batch, { ordered: false });
          count += batch.length;
          console.log(`Inserted ${count} documents into "${colName}"...`);
        } catch (err) {
          if (err.code === 11000) {
            count += err.insertedDocs ? err.insertedDocs.length : 0;
            console.log(`Batch inserted with some duplicate keys. Total inserted: ${count}`);
          } else {
            console.error(`Error inserting batch into "${colName}":`, err.message);
          }
        }
        batch = [];
        pipeline.resume();
      }
    });

    pipeline.on('end', async () => {
      if (batch.length > 0) {
        try {
          await collection.insertMany(batch, { ordered: false });
          count += batch.length;
          console.log(`Inserted ${count} documents into "${colName}"...`);
        } catch (err) {
          if (err.code === 11000) {
            count += err.insertedDocs ? err.insertedDocs.length : 0;
            console.log(`Batch inserted with some duplicate keys. Total inserted: ${count}`);
          } else {
            console.error(`Error inserting final batch into "${colName}":`, err.message);
          }
        }
      }
      console.log(`Finished inserting documents. Total: ${count}`);

      // 2. Rebuild indexes
      if (Model) {
        console.log(`Rebuilding indexes for "${colName}"...`);
        try {
          await Model.createIndexes();
          console.log(`Indexes rebuilt successfully for "${colName}".`);
        } catch (err) {
          console.error(`Error building indexes for "${colName}":`, err.message);
        }
      }

      resolve();
    });

    pipeline.on('error', (err) => {
      console.error(`Pipeline error in collection "${colName}":`, err);
      reject(err);
    });
  });
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected successfully.');

  for (const colInfo of COLLECTIONS) {
    await importCollection(colInfo);
  }

  console.log('\nAll collections imported successfully!');
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

run().catch(err => {
  console.error('Fatal error during import process:', err);
  mongoose.disconnect();
});
