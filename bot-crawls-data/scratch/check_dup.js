require('dotenv').config();
const mongoose = require('mongoose');
const Dup = require('../src/models/Duplicate');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/thong_ke_dau_gia');
  
  const d = await Dup.findOne({ sourceIds: 560715 });
  if (d) {
    console.log('=== NHÓM "CĂN TIN" ===');
    console.log('Name:', d.name);
    console.log('SourceIds:', JSON.stringify(d.sourceIds));
    console.log('isPriceDrop:', d.isPriceDrop);
    console.log('firstPrice:', d.firstPrice?.toLocaleString('vi-VN'), 'VNĐ');
    console.log('latestPrice:', d.latestPrice?.toLocaleString('vi-VN'), 'VNĐ');
    console.log('priceDropPercent:', d.priceDropPercent + '%');
    console.log('relistCount:', d.relistCount);
    console.log('\nLịch sử đăng:');
    (d.entries || []).forEach((e, i) => {
      const priceStr = e.price ? e.price.toLocaleString('vi-VN') + ' VNĐ' : 'N/A';
      const dateStr = e.publishedAt ? new Date(e.publishedAt).toLocaleDateString('vi-VN') : 'N/A';
      const changeStr = i > 0 && d.entries[i-1].price && e.price 
        ? ` (${e.price < d.entries[i-1].price ? '↓ giảm' : e.price > d.entries[i-1].price ? '↑ tăng' : '= giữ nguyên'} ${Math.abs(Math.round((e.price - d.entries[i-1].price) / d.entries[i-1].price * 100))}%)`
        : '';
      console.log(`  Lần ${i+1}: ID=${e.sourceId} | ${priceStr} | Ngày: ${dateStr} | ${e.publishRoundLabel || 'N/A'}${changeStr}`);
    });
  }

  // Show some price drop examples
  console.log('\n\n=== TOP 10 NHÓM GIẢM GIÁ NHIỀU NHẤT ===');
  const topDrops = await Dup.find({ isPriceDrop: true }).sort({ priceDropPercent: -1 }).limit(10).lean();
  topDrops.forEach((d, i) => {
    console.log(`${i+1}. ${d.name?.substring(0, 60)} | -${d.priceDropPercent}% | ${d.firstPrice?.toLocaleString('vi-VN')} → ${d.latestPrice?.toLocaleString('vi-VN')} | ${d.relistCount} lần`);
  });

  // Stats summary
  const totalDups = await Dup.countDocuments();
  const priceDrops = await Dup.countDocuments({ isPriceDrop: true });
  const multiRelist = await Dup.countDocuments({ relistCount: { $gte: 3 } });
  console.log(`\n=== THỐNG KÊ ===`);
  console.log(`Tổng nhóm đăng lại: ${totalDups}`);
  console.log(`Nhóm có biến động giá: ${priceDrops}`);
  console.log(`Nhóm đăng ≥3 lần: ${multiRelist}`);

  await mongoose.disconnect();
})();
