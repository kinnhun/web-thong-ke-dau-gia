const mongoose = require('mongoose');
const config = require('./src/config');
const AuctionNotice = require('./src/models/AuctionNotice');
const OrgSelection = require('./src/models/OrgSelection');
const { 
  fetchAuctionItemDetail, 
  fetchOrgItemDetail,
  searchDuplicatesByFuzzyName,
  handleDuplicate
} = require('./src/scrapers/detail.scraper');
const { closeBrowser } = require('./src/browser');

function isAuctionDetailIncomplete(item) {
  return item.detailScraped !== true
    || !Array.isArray(item.properties)
    || item.properties.length === 0
    || !item.initialPrice
    || !item.address
    || !item.name
    || !item.province
    || !item.sourceUrl;
}

function isOrgDetailIncomplete(item) {
  return item.detailScraped !== true
    || !item.startingPrice
    || !item.province
    || !item.name
    || !item.sourceUrl;
}

async function fixMissingData() {
  await mongoose.connect(config.mongo.uri);
  console.log('Đã kết nối MongoDB. Đang quét tìm các bài viết bị thiếu/lỗi dữ liệu...');

  // 1. Quét AuctionNotice
  console.log('Đang nạp dữ liệu Đấu giá...');
  const auctionCursor = AuctionNotice.find().cursor();
  const incompleteAuctions = [];
  for await (const doc of auctionCursor) {
    if (isAuctionDetailIncomplete(doc)) incompleteAuctions.push(doc);
  }
  console.log(`Phát hiện ${incompleteAuctions.length} bài đăng Đấu Giá bị thiếu/lỗi dữ liệu.`);

  for (let i = 0; i < incompleteAuctions.length; i++) {
    const item = incompleteAuctions[i];
    console.log(`[Auction ${i+1}/${incompleteAuctions.length}] Cào lại #${item.sourceId} - ${item.name || 'No Name'}`);
    try {
      const { updates, files } = await fetchAuctionItemDetail(item.sourceId);
      if (updates && Object.keys(updates).length > 0) {
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;
        await AuctionNotice.updateOne({ _id: item._id }, { $set: updates });
        
        const currentName = updates.name || item.name;
        if (currentName) {
           const exactNameRelatedIds = await searchDuplicatesByFuzzyName(item.sourceId, currentName, 'auction');
           const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];
           if (allRelatedIds.length > 0) {
             await handleDuplicate(item.sourceId, currentName, allRelatedIds, 'auction');
           }
        }
        console.log(`   -> Cập nhật thành công!`);
      } else {
        console.log(`   -> API không trả về dữ liệu mới.`);
      }
    } catch (err) {
      console.error(`   -> Lỗi khi cào:`, err.message);
    }
  }

  // 2. Quét OrgSelection
  console.log('\nĐang nạp dữ liệu Tổ chức Đấu giá...');
  const orgCursor = OrgSelection.find().cursor();
  const incompleteOrgs = [];
  for await (const doc of orgCursor) {
    if (isOrgDetailIncomplete(doc)) incompleteOrgs.push(doc);
  }
  console.log(`Phát hiện ${incompleteOrgs.length} bài đăng Tổ chức bị thiếu/lỗi dữ liệu.`);

  for (let i = 0; i < incompleteOrgs.length; i++) {
    const item = incompleteOrgs[i];
    console.log(`[Org ${i+1}/${incompleteOrgs.length}] Cào lại #${item.sourceId} - ${item.name || 'No Name'}`);
    try {
      const { updates, files } = await fetchOrgItemDetail(item.sourceId);
      if (updates && Object.keys(updates).length > 0) {
        updates.detailScraped = true;
        updates.lastCrawledAt = new Date();
        if (files && files.length > 0) updates.files = files;
        await OrgSelection.updateOne({ _id: item._id }, { $set: updates });
        
        const currentName = updates.name || item.name;
        if (currentName) {
           const exactNameRelatedIds = await searchDuplicatesByFuzzyName(item.sourceId, currentName, 'org');
           const allRelatedIds = [...new Set([...(updates.relatedIds || []), ...exactNameRelatedIds])];
           if (allRelatedIds.length > 0) {
             await handleDuplicate(item.sourceId, currentName, allRelatedIds, 'org');
           }
        }
        console.log(`   -> Cập nhật thành công!`);
      } else {
        console.log(`   -> API không trả về dữ liệu mới.`);
      }
    } catch (err) {
      console.error(`   -> Lỗi khi cào:`, err.message);
    }
  }

  console.log('\nĐóng trình duyệt và thoát...');
  await closeBrowser();
  mongoose.disconnect();
  process.exit(0);
}

fixMissingData().catch(console.error);
