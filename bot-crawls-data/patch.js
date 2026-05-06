const fs = require('fs');
const path = 'd:/web-thong-ke-dau-gia/bot-crawls-data/src/api/routes.js';
let content = fs.readFileSync(path, 'utf8');

const searchRegex = /router\.post\('\/trigger-scan-duplicate-item', async \(req, res, next\) => \{[\s\S]*?\} catch \(err\) \{ next\(err\); \}\n\}\);/;

const replacement = `router.post('/trigger-scan-duplicate-item', async (req, res, next) => {
  try {
    const { handleDuplicate, searchDuplicatesByFuzzyName, getFuzzyNameGroupsFiltered } = require('../scrapers/detail.scraper');
    const sourceId = parseInt(req.body?.sourceId);
    const type = req.body?.type || 'auction'; // 'auction' or 'org'
    if (!sourceId) return res.status(400).json({ error: true, message: 'sourceId is required' });

    const Model = type === 'org' ? OrgSelection : AuctionNotice;
    const item = await Model.findOne({ sourceId });
    if (!item) {
      return res.status(404).json({ error: true, message: \`Không tìm thấy \${type} #\${sourceId}\` });
    }

    const log = await CrawlLog.create({
      type: 'single_duplicate_scan',
      startedAt: new Date(),
      status: 'running',
      itemsUpdated: 0,
      errorMessages: [\`Đang quét trùng lặp cho \${type} #\${sourceId}\`]
    });

    res.json({
      success: true,
      message: \`Hệ thống đang tiến hành quét trùng lặp cho \${type} #\${sourceId} ngầm. Vui lòng tải lại trang sau vài giây.\`,
      sourceId,
      logId: log._id,
      status: 'processing'
    });

    Promise.resolve().then(async () => {
      try {
        if (type === 'auction') {
          const exactNameRelatedIds = await searchDuplicatesByFuzzyName(sourceId, item.name, 'auction');
          const allRelatedIds = [...new Set([...(item.relatedIds || []), ...exactNameRelatedIds])];
          
          if (allRelatedIds.length > 0) {
            console.log(\`[SCAN BG] Bắt đầu gộp duplicate cho #\${sourceId} với \${allRelatedIds.length} items:\`, allRelatedIds);
            
            const itemsToScan = await Model.find({ sourceId: { $in: allRelatedIds } }).select('sourceId name province').lean();
            const groups = await getFuzzyNameGroupsFiltered(itemsToScan, () => {});
            const targetGroup = groups.find(g => g.ids.includes(sourceId));
            
            if (targetGroup) {
              await handleDuplicate(sourceId, item.name, targetGroup.ids, 'auction');
              log.itemsUpdated = targetGroup.ids.length;
              log.errorMessages.push(\`Đã gộp thành công \${targetGroup.ids.length} bài đăng.\`);
            } else {
              await handleDuplicate(sourceId, item.name, allRelatedIds, 'auction');
              log.itemsUpdated = allRelatedIds.length;
              log.errorMessages.push(\`Đã gộp thành công \${allRelatedIds.length} bài đăng (Fallback).\`);
            }
            console.log(\`[SCAN BG] ✅ Hoàn thành cho #\${sourceId}\`);
          } else {
             log.errorMessages.push(\`Không tìm thấy bài đăng nào có thể gộp với #\${sourceId}.\`);
          }
        } else {
           log.errorMessages.push(\`Tính năng quét trùng lặp đơn lẻ chỉ mới hỗ trợ cho loại 'auction'.\`);
        }
        log.status = 'completed';
      } catch (err) {
        console.error(\`[SCAN BG] ❌ Lỗi xử lý ngầm #\${sourceId}:\`, err.message);
        log.status = 'failed';
        log.errorMessages.push(\`Lỗi: \${err.message}\`);
      } finally {
        log.finishedAt = new Date();
        await CrawlLog.updateOne({ _id: log._id }, { $set: { status: log.status, finishedAt: log.finishedAt, itemsUpdated: log.itemsUpdated, errorMessages: log.errorMessages } });
      }
    });

  } catch (err) { next(err); }
});`;

content = content.replace(searchRegex, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Replaced successfully');
