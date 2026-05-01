const {connectDB} = require('./src/db');
const AuctionNotice = require('./src/models/AuctionNotice');

connectDB().then(async () => {
    console.log("Connected. Querying name and province...");
    console.time('find_fuzzy');
    const items = await AuctionNotice.find({ name: { $type: 'string', $ne: '' } })
      .select('sourceId name province')
      .lean();
    console.timeEnd('find_fuzzy');
    console.log(`Found ${items.length} items`);
    process.exit(0);
});
