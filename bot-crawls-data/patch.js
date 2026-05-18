const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'src/api/routes.js');
let content = fs.readFileSync(p, 'utf8');

const target = `            const itemsToScan = await Model.find({ sourceId: { $in: allRelatedIds } }).select('sourceId name province').lean();
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
            console.log(\`[SCAN BG] ✅ Hoàn thành cho #\${sourceId}\`);`;

const replacement = `            const itemsToScan = await Model.find({ sourceId: { $in: allRelatedIds } }).select('sourceId name province').lean();
            
            // THÊM CHÍNH NÓ VÀO itemsToScan để nhóm có gốc so sánh
            itemsToScan.push({ sourceId: item.sourceId, name: item.name, province: item.province });
            
            const groups = await getFuzzyNameGroupsFiltered(itemsToScan, () => {});
            const targetGroup = groups.find(g => g.ids.includes(sourceId));
            
            if (targetGroup && targetGroup.ids.length > 1) {
              const otherIds = targetGroup.ids.filter(id => id !== sourceId);
              await handleDuplicate(sourceId, item.name, otherIds, 'auction');
              log.itemsUpdated = otherIds.length;
              log.errorMessages.push(\`Đã gộp thành công \${otherIds.length} bài đăng trùng khớp.\`);
            } else {
              log.errorMessages.push(\`Không có bài đăng nào đủ điều kiện gộp với #\${sourceId} sau khi phân tích kỹ.\`);
            }
            console.log(\`[SCAN BG] ✅ Hoàn thành cho #\${sourceId}\`);`;

// Replace handling cross-platform line endings
content = content.replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));
content = content.replace(target, replacement);

fs.writeFileSync(p, content, 'utf8');
console.log("Patched!");
