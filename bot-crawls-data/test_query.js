const {connectDB} = require('./src/db');
const AuctionNotice = require('./src/models/AuctionNotice');

connectDB().then(async () => {
    console.log("Connected. Querying relatedIds...");
    console.time('find_related');
    const auctions = await AuctionNotice.find({ relatedIds: { $exists: true, $not: { $size: 0 } } })
      .select('sourceId relatedIds')
      .lean();
    console.timeEnd('find_related');
    console.log(`Found ${auctions.length} auctions with relatedIds`);
    process.exit(0);
});
