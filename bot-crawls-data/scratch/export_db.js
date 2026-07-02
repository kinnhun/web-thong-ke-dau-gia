/**
 * Export MongoDB database thong_ke_dau_gia → E:\backup
 * Dùng Node.js driver thay vì mongodump (không cần cài MongoDB Tools)
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');
const { Readable, Transform } = require('stream');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'thong_ke_dau_gia';
const OUTPUT_DIR = 'E:\\backup_thong_ke_dau_gia_20260702';

async function run() {
  // Tạo thư mục output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('✅ Connected to MongoDB');

  const db = client.db(DB_NAME);
  const collections = await db.listCollections().toArray();
  
  console.log(`📦 Database: ${DB_NAME}`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`📋 Collections: ${collections.length}\n`);

  let totalDocs = 0;
  let totalSize = 0;

  for (const col of collections) {
    const name = col.name;
    const collection = db.collection(name);
    const count = await collection.estimatedDocumentCount();
    
    const outFile = path.join(OUTPUT_DIR, `${name}.json.gz`);
    
    process.stdout.write(`  ⏳ ${name} (${count.toLocaleString()} docs)...`);
    const startTime = Date.now();

    // Stream documents → JSON lines → gzip → file
    const cursor = collection.find({}).batchSize(5000);
    const writeStream = fs.createWriteStream(outFile);
    const gzip = createGzip({ level: 6 });

    let docCount = 0;
    const jsonStream = new Transform({
      objectMode: true,
      transform(doc, encoding, callback) {
        docCount++;
        if (docCount % 50000 === 0) {
          process.stdout.write(`\r  ⏳ ${name} (${docCount.toLocaleString()}/${count.toLocaleString()})...`);
        }
        this.push(JSON.stringify(doc) + '\n');
        callback();
      }
    });

    const cursorStream = cursor.stream();
    await pipeline(cursorStream, jsonStream, gzip, writeStream);

    const fileSize = fs.statSync(outFile).size;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const sizeMB = (fileSize / 1024 / 1024).toFixed(1);

    console.log(`\r  ✅ ${name.padEnd(30)} ${String(docCount).padStart(8)} docs | ${sizeMB.padStart(7)} MB | ${elapsed}s`);

    totalDocs += docCount;
    totalSize += fileSize;
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  HOÀN TẤT`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  📦 Tổng: ${totalDocs.toLocaleString()} documents`);
  console.log(`  💾 Kích thước: ${(totalSize / 1024 / 1024).toFixed(1)} MB (nén gzip)`);
  console.log(`  📁 Lưu tại: ${OUTPUT_DIR}`);

  await client.close();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
