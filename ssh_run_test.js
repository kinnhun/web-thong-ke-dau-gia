const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat << 'EOF' > /var/www/web-thong-ke-dau-gia/bot-crawls-data/test_dup.js
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia').then(async () => {
  const { searchDuplicatesByFuzzyName, handleDuplicate } = require('./src/scrapers/detail.scraper');
  const ids = await searchDuplicatesByFuzzyName(562918, 'Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 490 Gia Phú, Phường 3, Quận 6 (nay là phường Bình Tiên), Thành phố Hồ Chí Minh', 'auction');
  console.log('Fuzzy Search Found:', ids);
  if (ids.length > 0) {
    await handleDuplicate(562918, 'Quyền sử dụng đất ở và quyền sở hữu nhà ở tại địa chỉ số 490 Gia Phú, Phường 3, Quận 6 (nay là phường Bình Tiên), Thành phố Hồ Chí Minh', ids, 'auction');
    console.log('Merged successfully!');
  }
  mongoose.disconnect();
}).catch(console.error);
EOF
cd /var/www/web-thong-ke-dau-gia/bot-crawls-data && node test_dup.js`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data))
      .stderr.on('data', (data) => process.stderr.write(data));
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
