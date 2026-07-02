import fs from 'fs';
import mongoose from 'mongoose';
import { streamArray } from 'stream-json/streamers/stream-array.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/thong_ke_dau_gia';
const FILE_PATH = 'E:\\New folder (2)\\Neuer Ordner\\thong_ke_dau_gia.auctionnotices.json';

// Simple recursive function to convert MongoDB Extended JSON to native types
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
  
  // Handle $numberDouble, $numberInt, $numberLong
  if (obj.$numberDouble) return parseFloat(obj.$numberDouble);
  if (obj.$numberInt) return parseInt(obj.$numberInt, 10);
  if (obj.$numberLong) return parseInt(obj.$numberLong, 10);

  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = convertExtendedJson(obj[key]);
  }
  return result;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');
  
  const collection = mongoose.connection.db.collection('auctionnotices');

  let batch = [];
  const BATCH_SIZE = 2000;
  let count = 0;

  // Use the new API for stream-json v2
  const pipeline = fs.createReadStream(FILE_PATH).pipe(streamArray.withParserAsStream());

  pipeline.on('data', async (data) => {
    let doc = data.value;
    doc = convertExtendedJson(doc);
    batch.push(doc);

    if (batch.length >= BATCH_SIZE) {
      pipeline.pause();
      try {
        await collection.insertMany(batch, { ordered: false });
        count += batch.length;
        console.log(`Inserted ${count} documents...`);
      } catch (err) {
        if (err.code === 11000) {
            count += err.insertedDocs ? err.insertedDocs.length : 0;
            console.log(`Batch inserted with some duplicate keys. Total inserted: ${count}`);
        } else {
            console.log(`Error inserting batch:`, err.message);
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
        console.log(`Inserted ${count} documents...`);
      } catch (err) {
        if (err.code === 11000) {
            count += err.insertedDocs ? err.insertedDocs.length : 0;
            console.log(`Batch inserted with some duplicate keys. Total inserted: ${count}`);
        } else {
            console.log(`Error inserting final batch:`, err.message);
        }
      }
    }
    console.log(`Done! Total inserted successfully: ${count}`);
    mongoose.connection.close();
  });
  
  pipeline.on('error', (err) => {
      console.error('Pipeline error:', err);
      mongoose.connection.close();
  });
}

run().catch(console.error);
