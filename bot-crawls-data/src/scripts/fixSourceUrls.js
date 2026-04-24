/**
 * Script fix sourceUrl bị thiếu slug (chỉ có ID, thiếu tên tài sản)
 * Sai: /thong-bao-cong-khai-viec-dau-gia/559827.html
 * Đúng: /thong-bao-cong-khai-viec-dau-gia/o-to-dau-keo-...-559827.html
 */
require('dotenv').config();
const mongoose = require('mongoose');
const AuctionNotice = require('../models/AuctionNotice');
const OrgSelection = require('../models/OrgSelection');
const { slugify } = require('../utils/helpers');

const AUCTION_BASE = 'thong-bao-cong-khai-viec-dau-gia';
const ORG_BASE = 'thong-bao-lua-chon-to-chuc-dau-gia';

async function fixUrls() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thong_ke_dau_gia');
  console.log('Connected to MongoDB');

  // Pattern: URL kết thúc bằng /số.html (thiếu slug)
  const brokenPattern = /\/(thong-bao-cong-khai-viec-dau-gia|thong-bao-lua-chon-to-chuc-dau-gia)\/(\d+)\.html$/;

  // Fix AuctionNotice
  const brokenAuctions = await AuctionNotice.find({
    sourceUrl: { $regex: `/${AUCTION_BASE}/\\d+\\.html$` }
  }).select('sourceId name sourceUrl');

  console.log(`Found ${brokenAuctions.length} AuctionNotice with broken URLs`);
  let fixedA = 0;
  for (const item of brokenAuctions) {
    if (!item.name) continue;
    const slug = slugify(item.name);
    const newUrl = `https://dgts.moj.gov.vn/${AUCTION_BASE}/${slug}-${item.sourceId}.html`;
    if (newUrl !== item.sourceUrl) {
      await AuctionNotice.updateOne({ _id: item._id }, { $set: { sourceUrl: newUrl } });
      fixedA++;
    }
  }
  console.log(`Fixed ${fixedA} AuctionNotice URLs`);

  // Fix OrgSelection
  const brokenOrgs = await OrgSelection.find({
    sourceUrl: { $regex: `/${ORG_BASE}/\\d+\\.html$` }
  }).select('sourceId name sourceUrl');

  console.log(`Found ${brokenOrgs.length} OrgSelection with broken URLs`);
  let fixedO = 0;
  for (const item of brokenOrgs) {
    if (!item.name) continue;
    const slug = slugify(item.name);
    const newUrl = `https://dgts.moj.gov.vn/${ORG_BASE}/${slug}-${item.sourceId}.html`;
    if (newUrl !== item.sourceUrl) {
      await OrgSelection.updateOne({ _id: item._id }, { $set: { sourceUrl: newUrl } });
      fixedO++;
    }
  }
  console.log(`Fixed ${fixedO} OrgSelection URLs`);

  console.log(`\n✅ Done. Total fixed: ${fixedA + fixedO}`);
  await mongoose.disconnect();
}

fixUrls().catch(err => { console.error(err); process.exit(1); });
