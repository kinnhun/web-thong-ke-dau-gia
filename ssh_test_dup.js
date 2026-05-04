const { Client } = require('ssh2');

const script = `
require('dotenv').config({ path: '/var/www/web-thong-ke-dau-gia/bot-crawls-data/.env' });
const mongoose = require('mongoose');
const AuctionNotice = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/models/AuctionNotice');
const { extractCoreIdentity, extractPropertyIdentifiers, hasConflictingIdentifiers, getBigrams, getNumberTokens, jaccardSimilarity } = require('/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/utils/helpers');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  
  const ids = [454852, 561763, 471403];
  const items = await AuctionNotice.find({ sourceId: { $in: ids } }).lean();
  console.log('Found ' + items.length + ' items.');
  
  for (let item of items) {
    console.log('\\nID: ' + item.sourceId);
    console.log('Name: ' + item.name);
    console.log('Core: ' + extractCoreIdentity(item.name));
    console.log('Numbers: ' + getNumberTokens(item.name));
    console.log('Identifiers:', extractPropertyIdentifiers(item.name));
  }

  if (items.length > 0) {
    const targetName = items[0].name;
    const targetNums = getNumberTokens(targetName);
    let dbCandidatesRegex = [];
    if (targetNums.length > 0 && targetNums.length <= 5) {
       const regexQueries = targetNums.map(num => ({ name: { $regex: num, $options: 'i' } }));
       dbCandidatesRegex = await AuctionNotice.find({ $and: regexQueries })
         .limit(100)
         .select('sourceId name')
         .lean();
    }

    console.log('\\nRegex search for ' + targetNums.join(', ') + ' returned ' + dbCandidatesRegex.length + ' results.');
    console.log('Does it contain 561763? ' + dbCandidatesRegex.some(c => c.sourceId === 561763));
    console.log('Does it contain 471403? ' + dbCandidatesRegex.some(c => c.sourceId === 471403));
  }

  mongoose.disconnect();
}
test().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat << "EOF" > /var/www/web-thong-ke-dau-gia/bot-crawls-data/test_dup.js\n' + script + '\nEOF\ncd /var/www/web-thong-ke-dau-gia/bot-crawls-data && node test_dup.js', (err, stream) => {
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
