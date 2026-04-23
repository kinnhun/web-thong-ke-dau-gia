const config = require('../config');
const { fetchDetailHTML, fetchAPI } = require('../browser');
const AuctionNotice = require('../models/AuctionNotice');
const CrawlLog = require('../models/CrawlLog');
const { parsePrice, extractProvince, delay } = require('../utils/helpers');

/**
 * Cào chi tiết từng thông báo đấu giá
 * Lấy thêm thông tin: giá, địa chỉ, tiền đặt trước, điều kiện...
 */
async function crawlDetails(options = {}) {
  const maxItems = options.maxItems || 100;

  const log = await CrawlLog.create({
    type: 'detail',
    startedAt: new Date(),
    itemsUpdated: 0,
    itemsSkipped: 0,
    pagesProcessed: 0,
    errorMessages: [],
  });

  let stats = { updated: 0, skipped: 0, errors: 0 };
  let processed = 0;

  console.log(`\n🔍 Bắt đầu cào chi tiết (tối đa ${maxItems} items)...`);

  try {
    const totalPending = await AuctionNotice.countDocuments({ detailScraped: { $ne: true } });
    const limit = Math.min(maxItems, totalPending);
    console.log(`📊 Cần cào: ${limit}/${totalPending} items`);

    const items = await AuctionNotice.find({ detailScraped: { $ne: true } })
      .sort({ publishedAt: -1 })
      .limit(limit);

    for (const item of items) {
      try {
        await delay(config.crawl.delayMs);
        
        // 1. Fetch JSON API for exact properties
        let apiData = null;
        let viewDetailData = null;
        try {
          const json = await fetchAPI('/portal/propertyInfo', { auctionInfoId: item.sourceId });
          if (json && json.items && json.items.length > 0) {
            // Có thể có nhiều tài sản trong 1 thông báo, lấy cái đầu tiên làm đại diện hoặc gộp
            apiData = json.items[0]; 
          }
          const viewDetail = await fetchAPI('/portal/viewDetailAuctionInfo', { auctionInfoId: item.sourceId });
          if (viewDetail) {
            viewDetailData = viewDetail;
          }
        } catch (e) {
          // Fallback if API fails
        }

        // 2. Fetch HTML for rich text conditions/descriptions
        const html = await fetchDetailHTML(item.sourceUrl);

        if (html || apiData) {
          const detail = html ? parseDetailHTML(html) : {};
          const updates = { detailScraped: true, lastCrawledAt: new Date() };

          // Áp dụng dữ liệu từ JSON API (Độ chính xác tuyệt đối)
          if (apiData) {
            if (apiData.propertyPlace) updates.address = apiData.propertyPlace;
            if (apiData.propertyStartPrice) {
              updates.initialPrice = apiData.propertyStartPrice;
              updates.currentPrice = apiData.propertyStartPrice;
            }
            if (apiData.deposit) updates.deposit = apiData.deposit;
            if (apiData.fileCost) updates.applicationFee = apiData.fileCost;
            if (apiData.propertyAmount) updates.propertyAmount = apiData.propertyAmount;
            if (apiData.propertyQuality) updates.quality = apiData.propertyQuality;
          }

          // Fallback dữ liệu từ parse HTML (nếu JSON API không có)
          if (!updates.address && detail.address) updates.address = detail.address;
          if (detail.district) updates.district = detail.district;
          if (detail.province) updates.province = detail.province || item.province;
          if (!updates.initialPrice && detail.initialPrice) updates.initialPrice = detail.initialPrice;
          if (!updates.currentPrice && detail.currentPrice) updates.currentPrice = detail.currentPrice;
          if (!updates.deposit && detail.deposit) updates.deposit = detail.deposit;
          if (!updates.depositPercent && detail.depositPercent) updates.depositPercent = detail.depositPercent;
          if (!updates.propertyAmount && detail.propertyAmount) updates.propertyAmount = detail.propertyAmount;
          if (!updates.quality && detail.quality) updates.quality = detail.quality;
          if (detail.conditions) updates.conditions = detail.conditions;

          // Lấy danh sách file đính kèm
          if (viewDetailData && Array.isArray(viewDetailData.listFile) && viewDetailData.listFile.length > 0) {
            updates.files = viewDetailData.listFile.map(f => ({
              name: f.fileName,
              url: f.linkFile ? `https://dgts.moj.gov.vn/portal/downloadFile?linkFile=${encodeURIComponent(f.linkFile)}` : ''
            })).filter(f => f.url);
          }

          await AuctionNotice.updateOne({ _id: item._id }, { $set: updates });
          stats.updated++;
        } else {
          await AuctionNotice.updateOne({ _id: item._id }, { $set: { detailScraped: true } });
          stats.skipped++;
        }
      } catch (err) {
        stats.errors++;
        // Mark as scraped to not retry
        await AuctionNotice.updateOne({ _id: item._id }, { $set: { detailScraped: true } });
        if (stats.errors <= 5) console.error(`  ⚠️ ${item.sourceId}: ${err.message}`);
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`  🔎 ${processed}/${limit} | ✅ ${stats.updated} | ❌ ${stats.errors}`);
      }
    }

    log.status = 'completed';
    console.log(`\n✅ Detail hoàn thành! Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`);
  } catch (err) {
    log.status = 'failed';
    log.errorMessages.push(err.message);
    console.error(`\n❌ Detail crawl thất bại: ${err.message}`);
  }

  log.finishedAt = new Date();
  log.itemsUpdated = stats.updated;
  log.itemsSkipped = stats.skipped;
  log.pagesProcessed = processed;
  await log.save();

  return stats;
}

const OrgSelection = require('../models/OrgSelection');

/**
 * Cào chi tiết Lựa chọn tổ chức đấu giá
 */
async function crawlOrgDetails(options = {}) {
  const maxItems = options.maxItems || 50;

  const log = await CrawlLog.create({
    type: 'org_detail',
    startedAt: new Date(),
    itemsUpdated: 0,
    itemsSkipped: 0,
    pagesProcessed: 0,
    errorMessages: [],
  });

  let stats = { updated: 0, skipped: 0, errors: 0 };
  let processed = 0;

  console.log(`\n🔍 Bắt đầu cào chi tiết Tổ chức Đấu Giá (tối đa ${maxItems} items)...`);

  try {
    const totalPending = await OrgSelection.countDocuments({ detailScraped: { $ne: true } });
    const limit = Math.min(maxItems, totalPending);
    console.log(`📊 Cần cào: ${limit}/${totalPending} items`);

    const items = await OrgSelection.find({ detailScraped: { $ne: true } })
      .sort({ publishedAt: -1 })
      .limit(limit);

    for (const item of items) {
      try {
        await delay(config.crawl.delayMs);
        
        let apiData = null;
        let editNoticeData = null;
        try {
          const json = await fetchAPI('/portal/propertyInfo', { auctionInfoId: item.sourceId });
          if (json && json.items && json.items.length > 0) {
            apiData = json.items[0]; 
          }
        } catch (e) {}

        try {
          const editNotice = await fetchAPI('/ThongTin/getInfoEditNotice', { id: item.sourceId });
          if (editNotice) {
            editNoticeData = editNotice;
          }
        } catch (e) {}

        const html = await fetchDetailHTML(item.sourceUrl);

        if (html || apiData) {
          const updates = { detailScraped: true, lastCrawledAt: new Date() };

          if (apiData) {
            if (apiData.propertyPlace) updates.address = apiData.propertyPlace;
            if (apiData.propertyStartPrice) updates.startingPrice = apiData.propertyStartPrice;
            if (apiData.propertyQuality) updates.propertyTypeName = apiData.propertyQuality;
          }

          if (html) {
            // Lấy thông tin điều kiện từ HTML
            const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const tds = [];
            let match;
            while ((match = tdPattern.exec(html)) !== null) {
              const text = match[1].replace(/<[^>]+>/g, '').trim();
              if (text) tds.push(text);
            }

            for (const td of tds) {
              if (td.length > 50 && td.toLowerCase().includes('tiêu chí') && !updates.requirements) {
                updates.requirements = td.substring(0, 1000);
              }
              if (td.length > 50 && td.toLowerCase().includes('quyền sử dụng') && !updates.assetDescription) {
                updates.assetDescription = td.substring(0, 1000);
              }
            }
          }

          // Lấy danh sách file đính kèm
          const files = [];
          if (editNoticeData) {
            if (Array.isArray(editNoticeData.listFileNotice)) {
              editNoticeData.listFileNotice.forEach(f => {
                if (f.linkFile) {
                  files.push({
                    name: f.fileName,
                    url: `https://dgts.moj.gov.vn/ThongTin/downloadFile?linkFile=${encodeURIComponent(f.linkFile)}`
                  });
                }
              });
            }
            if (Array.isArray(editNoticeData.property)) {
              editNoticeData.property.forEach(p => {
                if (Array.isArray(p.listFile)) {
                  p.listFile.forEach(f => {
                    if (f.linkFile) {
                      files.push({
                        name: f.fileName,
                        url: `https://dgts.moj.gov.vn/ThongTin/downloadFile?linkFile=${encodeURIComponent(f.linkFile)}`
                      });
                    }
                  });
                }
              });
            }
          }
          if (files.length > 0) {
            updates.files = files;
          }

          await OrgSelection.updateOne({ _id: item._id }, { $set: updates });
          stats.updated++;
        } else {
          await OrgSelection.updateOne({ _id: item._id }, { $set: { detailScraped: true } });
          stats.skipped++;
        }
      } catch (err) {
        stats.errors++;
        await OrgSelection.updateOne({ _id: item._id }, { $set: { detailScraped: true } });
        if (stats.errors <= 5) console.error(`  ⚠️ ${item.sourceId}: ${err.message}`);
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`  🔎 ${processed}/${limit} | ✅ ${stats.updated} | ❌ ${stats.errors}`);
      }
    }

    log.status = 'completed';
    console.log(`\n✅ Org Detail hoàn thành! Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`);
  } catch (err) {
    log.status = 'failed';
    log.errorMessages.push(err.message);
    console.error(`\n❌ Org Detail crawl thất bại: ${err.message}`);
  }

  log.finishedAt = new Date();
  log.itemsUpdated = stats.updated;
  log.itemsSkipped = stats.skipped;
  log.pagesProcessed = processed;
  await log.save();

  return stats;
}

/**
 * Parse HTML detail page dùng regex (không cần cheerio, chạy nhẹ hơn)
 */
function parseDetailHTML(html) {
  const result = {};

  // Extract table data - tìm các cột trong bảng chi tiết
  // Bảng thường có: STT | Tên TS | Số lượng | Nơi có TS | Giá KĐ | Tiền ĐT | Thời gian ĐK...
  const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const tds = [];
  let match;
  while ((match = tdPattern.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text) tds.push(text);
  }

  // Tìm giá khởi điểm (các chuỗi có "đồng" hoặc số lớn)
  for (const td of tds) {
    const price = parsePrice(td);
    if (price > 1_000_000 && !result.initialPrice) {
      // Giá > 1 triệu, likely starting price
      if (td.toLowerCase().includes('đồng') || price > 10_000_000) {
        result.initialPrice = price;
        result.currentPrice = price;
      }
    }
  }

  // Tìm tiền đặt trước (% hoặc số tiền)
  for (const td of tds) {
    if (td.includes('%') && !result.depositPercent) {
      const pctMatch = td.match(/(\d+)\s*%/);
      if (pctMatch) {
        result.depositPercent = pctMatch[1] + '%';
        if (result.initialPrice) {
          result.deposit = Math.round(result.initialPrice * parseInt(pctMatch[1]) / 100);
        }
      }
    }
  }

  // Tìm nơi có tài sản (thường là chuỗi dài chứa tên tỉnh/huyện)
  for (const td of tds) {
    if (td.length > 20 && !result.address) {
      const province = extractProvince(td);
      if (province) {
        result.address = td;
        result.province = province;
        // Extract district
        const districtMatch = td.match(/(quận|huyện|thị xã|thành phố)\s+([^,;]+)/i);
        if (districtMatch) result.district = districtMatch[0].trim();
      }
    }
  }

  // Tìm số lượng
  for (const td of tds) {
    if (td.match(/^\d+\s*(thửa|lô|căn|chiếc|bộ|cái|hệ thống)/i) && !result.propertyAmount) {
      result.propertyAmount = td;
    }
  }

  // Tìm điều kiện
  for (const td of tds) {
    if (td.length > 50 && td.toLowerCase().includes('điều kiện') && !result.conditions) {
      result.conditions = td.substring(0, 500);
    }
  }

  // Tìm tên tài sản chi tiết
  for (const td of tds) {
    if (td.length > 30 && td.toLowerCase().includes('quyền sử dụng') && !result.quality) {
      result.quality = td.substring(0, 200);
    }
  }

  return result;
}

module.exports = { crawlDetails, crawlOrgDetails };
