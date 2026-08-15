const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

async function auditPastedIDs() {
  const logPath = 'C:\\Users\\trant\\.gemini\\antigravity-ide\\brain\\5e1f69a7-cc13-4dfe-bcc6-2823ec0bac88\\.system_generated\\logs\\transcript.jsonl';
  
  if (!fs.existsSync(logPath)) {
    console.error('Không tìm thấy file log transcript!');
    process.exit(1);
  }

  const lines = fs.readFileSync(logPath, 'utf-8').split('\n');
  let targetUserContent = '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'USER_INPUT' && entry.content && entry.content.includes('ID #13759')) {
        targetUserContent = entry.content;
        break;
      }
    } catch (e) {}
  }

  if (!targetUserContent) {
    console.error('Không tìm thấy tin nhắn chứa danh sách ID của người dùng!');
    process.exit(1);
  }

  const regex = /ID\s*#(\d+)/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(targetUserContent)) !== null) {
    matches.push(parseInt(match[1], 10));
  }

  const uniqueUserIDs = Array.from(new Set(matches)).sort((a, b) => a - b);
  console.log(`📌 Đã trích xuất ${uniqueUserIDs.length} mã ID từ danh sách bạn đã gửi (Từ ID #${uniqueUserIDs[0]} đến ID #${uniqueUserIDs[uniqueUserIDs.length - 1]}).\n`);

  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  const db = mongoose.connection.db;

  const rawDocs = await db.collection('raw_auction_ids').find({ sourceId: { $in: uniqueUserIDs } }).toArray();
  const rawFoundSet = new Set(rawDocs.map(d => d.sourceId));

  const noticeDocs = await db.collection('auctionnotices').find({ sourceId: { $in: uniqueUserIDs } }).toArray();
  const noticeFoundSet = new Set(noticeDocs.map(d => d.sourceId));

  const assetDocs = await db.collection('assetitems').find({ sourceId: { $in: uniqueUserIDs } }).toArray();
  const assetFoundSet = new Set(assetDocs.map(d => d.sourceId));

  const missingRaw = uniqueUserIDs.filter(id => !rawFoundSet.has(id));
  const hasDetailedContent = uniqueUserIDs.filter(id => noticeFoundSet.has(id) || assetFoundSet.has(id));
  const missingDetailedContent = uniqueUserIDs.filter(id => !noticeFoundSet.has(id) && !assetFoundSet.has(id));

  console.log('════════════════════════════════════════════════════════════');
  console.log('📈 KẾT QUẢ ĐỐI SOÁT CHI TIẾT TỪNG MÃ ID TRONG DATABASE:');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`🔢 Tổng số mã ID người dùng gửi:             ${uniqueUserIDs.length.toLocaleString('vi-VN')} IDs`);
  console.log(`✅ ID Đã ghi nhận CHỈ MỤC & SỐ TRANG (raw_auction_ids): ${rawFoundSet.size.toLocaleString('vi-VN')} / ${uniqueUserIDs.length} IDs (${((rawFoundSet.size/uniqueUserIDs.length)*100).toFixed(2)}%)`);
  console.log(`📝 ID ĐÃ CÀO CHI TIẾT NỘI DUNG BÀI VIẾT (auctionnotices/assetitems): ${hasDetailedContent.length.toLocaleString('vi-VN')} / ${uniqueUserIDs.length} IDs (${((hasDetailedContent.length/uniqueUserIDs.length)*100).toFixed(2)}%)`);
  console.log(`❌ ID CHƯA CÀO CHI TIẾT NỘI DUNG BÀI VIẾT: ${missingDetailedContent.length.toLocaleString('vi-VN')} / ${uniqueUserIDs.length} IDs (${((missingDetailedContent.length/uniqueUserIDs.length)*100).toFixed(2)}%)`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (hasDetailedContent.length > 0) {
    console.log(`🔍 Danh sách mẫu các ID ĐÃ CÓ dữ liệu cào chi tiết (${hasDetailedContent.length} IDs):`);
    console.log(`   ${hasDetailedContent.slice(0, 30).join(', ')}...`);
  }

  if (missingDetailedContent.length > 0) {
    console.log(`\n⚠️ Danh sách mẫu các ID CHƯA CÓ dữ liệu cào chi tiết (${missingDetailedContent.length} IDs):`);
    console.log(`   ${missingDetailedContent.slice(0, 30).join(', ')}...`);
  }

  // Xuất file JSON kết quả audit danh sách này
  const reportData = {
    auditAt: new Date(),
    totalChecked: uniqueUserIDs.length,
    rawFoundCount: rawFoundSet.size,
    hasDetailedContentCount: hasDetailedContent.length,
    missingDetailedContentCount: missingDetailedContent.length,
    hasDetailedContentIDs: hasDetailedContent,
    missingDetailedContentIDs: missingDetailedContent,
    missingRawIDs: missingRaw,
  };

  const exportPath = path.join(__dirname, 'audit_pasted_ids_result.json');
  fs.writeFileSync(exportPath, JSON.stringify(reportData, null, 2), 'utf-8');
  console.log(`\n📁 Đã xuất kết quả kiểm tra chi tiết ra file: ${exportPath}`);

  await mongoose.disconnect();
}

auditPastedIDs().catch(console.error);
