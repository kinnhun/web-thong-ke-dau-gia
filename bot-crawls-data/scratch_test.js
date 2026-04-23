const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
    const AuctionNotice = mongoose.model('AuctionNotice', new mongoose.Schema({},{strict:false}));
    const a = await AuctionNotice.find({ sourceId: { $in: [559279, 561145] } }).select('sourceId publishRound');
    console.log(a);
    mongoose.disconnect();
});
