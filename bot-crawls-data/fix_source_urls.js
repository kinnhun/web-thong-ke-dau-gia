require('dotenv').config();
const mongoose = require('mongoose');
const AuctionNotice = require('./src/models/AuctionNotice');
const OrgSelection = require('./src/models/OrgSelection');
const Duplicate = require('./src/models/Duplicate');
const { slugify } = require('./src/utils/helpers');

const BASE_URL = 'https://dgts.moj.gov.vn';

async function fixUrls() {
  await mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia');
  console.log('Connected to DB');

  // Fix AuctionNotice
  const auctions = await AuctionNotice.find({ sourceUrl: { $regex: 'thong-bao-cong-khai/' } });
  console.log(`Found ${auctions.length} auctions to fix`);
  for (const item of auctions) {
    const slug = slugify(item.name || '');
    const correctUrl = `${BASE_URL}/thong-bao-cong-khai-viec-dau-gia/${slug}-${item.sourceId}.html`;
    item.sourceUrl = correctUrl;
    await item.save();
  }

  // Fix OrgSelection
  const orgs = await OrgSelection.find({ sourceUrl: { $regex: 'thong-bao-cong-khai/' } });
  console.log(`Found ${orgs.length} orgs to fix`);
  for (const item of orgs) {
    const slug = slugify(item.name || '');
    const correctUrl = `${BASE_URL}/thong-bao-cong-khai-viec-lua-chon-to-chuc-dau-gia-tai-san/${slug}-${item.sourceId}.html`;
    item.sourceUrl = correctUrl;
    await item.save();
  }

  // Fix Duplicate entries
  const duplicates = await Duplicate.find({ 'entries.sourceUrl': { $regex: 'thong-bao-cong-khai/' } });
  console.log(`Found ${duplicates.length} duplicates to fix`);
  for (const dup of duplicates) {
    let changed = false;
    for (const entry of dup.entries) {
      if (entry.sourceUrl && entry.sourceUrl.includes('thong-bao-cong-khai/')) {
        const slug = slugify(dup.name || '');
        if (dup.type === 'auction') {
          entry.sourceUrl = `${BASE_URL}/thong-bao-cong-khai-viec-dau-gia/${slug}-${entry.sourceId}.html`;
        } else {
          entry.sourceUrl = `${BASE_URL}/thong-bao-cong-khai-viec-lua-chon-to-chuc-dau-gia-tai-san/${slug}-${entry.sourceId}.html`;
        }
        changed = true;
      }
    }
    if (changed) {
      dup.markModified('entries');
      await dup.save();
    }
  }

  console.log('Done fixing URLs!');
  process.exit(0);
}

fixUrls().catch(err => {
  console.error(err);
  process.exit(1);
});
