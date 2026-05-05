const { Client } = require('ssh2');

const script = `
const mongoose = require('mongoose');

const duplicateSchema = new mongoose.Schema({
  name: String, sourceIds: [Number], type: String, province: String, organizer: String,
  entries: [{ sourceId: Number, price: Number, publishedAt: Date, publishRound: Number, publishRoundLabel: String, rootId: Number, sourceUrl: String, _id: false }],
  firstPrice: Number, latestPrice: Number, priceDropPercent: Number, isPriceDrop: Boolean, relistCount: Number, rootId: Number,
}, { timestamps: true });
const Duplicate = mongoose.model('Duplicate', duplicateSchema);

const auctionSchema = new mongoose.Schema({}, { strict: false, collection: 'auctionnotices' });
const AuctionNotice = mongoose.model('AuctionNotice', auctionSchema);

async function fix() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');

  const items = await AuctionNotice.find({
    name: { $regex: '2207.*bản đồ.*3', $options: 'i' },
    province: 'Thành phố Hồ Chí Minh'
  }).select('sourceId name initialPrice currentPrice publishedAt publishRound publishRoundLabel rootId sourceUrl province organizer').lean();

  console.log('Found ' + items.length + ' matching items');
  items.forEach(i => console.log('  #' + i.sourceId + ': ' + (i.name || '').substring(0, 70)));

  if (items.length < 2) { console.log('Not enough'); mongoose.disconnect(); return; }

  const allIds = items.map(i => i.sourceId);
  const deleted = await Duplicate.deleteMany({ sourceIds: { $in: allIds } });
  console.log('Deleted ' + deleted.deletedCount + ' old duplicate records');

  const sorted = [...items].sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
  const entries = sorted.map(i => ({
    sourceId: i.sourceId, price: i.initialPrice || i.currentPrice || 0,
    publishedAt: i.publishedAt, publishRound: i.publishRound || 1,
    publishRoundLabel: i.publishRoundLabel || '', rootId: i.rootId || null, sourceUrl: i.sourceUrl || null,
  }));

  const pricesWithValues = entries.filter(e => e.price > 0);
  const firstPrice = pricesWithValues.length > 0 ? pricesWithValues[0].price : 0;
  const latestPrice = pricesWithValues.length > 0 ? pricesWithValues[pricesWithValues.length - 1].price : 0;
  const priceDrop = firstPrice > 0 && latestPrice < firstPrice;
  const dropPct = priceDrop ? Math.round((1 - latestPrice / firstPrice) * 10000) / 100 : 0;

  const dup = new Duplicate({
    name: sorted[0].name, sourceIds: allIds.sort((a, b) => a - b), type: 'auction',
    province: items.find(i => i.province)?.province, organizer: items.find(i => i.organizer)?.organizer,
    entries, firstPrice, latestPrice, priceDropPercent: dropPct, isPriceDrop: priceDrop,
    relistCount: entries.length, rootId: entries.find(e => e.rootId)?.rootId || null,
  });

  await dup.save();
  console.log('Created group: ' + dup.sourceIds.length + ' items, drop: ' + dropPct + '%');
  console.log('IDs: ' + dup.sourceIds.join(', '));
  mongoose.disconnect();
}
fix().catch(e => { console.error(e); process.exit(1); });
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected');
  conn.exec('cat << "ENDSCRIPT" > /var/www/web-thong-ke-dau-gia/bot-crawls-data/fix_dup.js\n' + script + '\nENDSCRIPT\ncd /var/www/web-thong-ke-dau-gia/bot-crawls-data && node fix_dup.js', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write('' + data))
      .stderr.on('data', (data) => process.stderr.write('' + data));
  });
}).connect({
  host: '14.225.206.67', port: 22, username: 'root', password: 'WfHdCZSkSVa6OGg3c7Wf',
  readyTimeout: 30000,
});
