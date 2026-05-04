const { Client } = require('ssh2');

const script = `
require('dotenv').config({ path: '/var/www/web-thong-ke-dau-gia/bot-crawls-data/.env' });
const mongoose = require('mongoose');
const AuctionNotice = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/models/AuctionNotice');
const Duplicate = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/models/Duplicate');
const { searchDuplicatesByFuzzyName, handleDuplicate } = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/scrapers/detail.scraper.js');

async function fix() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  
  const ids = [454852, 561763, 471403];
  
  // Clean up any old duplicate records specifically for these IDs to reset state
  await Duplicate.deleteMany({ sourceIds: { $in: ids } });
  
  for (let id of ids) {
    const item = await AuctionNotice.findOne({ sourceId: id }).lean();
    if (item) {
       console.log('Processing ' + id + '...');
       const relatedIds = await searchDuplicatesByFuzzyName(item.sourceId, item.name, 'auction');
       console.log('Related for ' + id + ':', relatedIds);
       
       if (relatedIds.length > 0) {
         await handleDuplicate(item.sourceId, item.name, relatedIds, 'auction');
         console.log('Handled duplicate for ' + id);
       }
    }
  }

  const dups = await Duplicate.find({ sourceIds: { $in: ids } }).lean();
  console.log('Final Duplicates:', JSON.stringify(dups, null, 2));

  mongoose.disconnect();
}
fix().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat << "EOF" > /var/www/web-thong-ke-dau-gia/bot-crawls-data/fix_dup.js\n' + script + '\nEOF\ncd /var/www/web-thong-ke-dau-gia/bot-crawls-data && node fix_dup.js', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
