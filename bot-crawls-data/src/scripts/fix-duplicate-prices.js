/**
 * Script 1 lần: Rebuild tất cả Duplicate entries với logic giảm giá đúng.
 * Chạy: node bot-crawls-data/src/scripts/fix-duplicate-prices.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { connectDB } = require('../db');
const { rebuildAllDuplicateEntries } = require('../scrapers/detail.scraper');

async function main() {
  await connectDB();
  console.log('🔧 Bắt đầu fix Duplicate prices...\n');
  
  const count = await rebuildAllDuplicateEntries();
  console.log(`\n✅ Đã rebuild ${count} nhóm Duplicate.`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
