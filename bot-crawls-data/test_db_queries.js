require('dotenv').config();
const mongoose = require('mongoose');
const AuctionNotice = require('./src/models/AuctionNotice');
const { extractPropertyIdentifiers, getNumberTokens } = require('./src/utils/helpers');

async function testQuery() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/thong_ke_dau_gia');
  
  const text1 = "Quyền sử dụng đất có diện tích 114,5m2 và nhà ở có diện tích xây dựng 72,2m2 thuộc thửa đất số 615 tờ bản đồ số 35 tọa lạc tại địa chỉ 55/5F ấp Trung Lân, xã Bà Điểm, huyện Hóc Môn, thành phố Hồ Chí Minh.";
  const text2 = "Quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất tại số 55/5F ấp Trung Lân, xã Bà Điểm, huyện Hóc Môn (nay là xã Bà Điểm), Thành phố Hồ Chí Minh.";
  
  const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Test from text2 to text1
  const searchNumbers = getNumberTokens(text2);
  let regexDbQuery = null;
  if (searchNumbers.length > 0) {
    const regexQueries = searchNumbers.map(num => ({ name: { $regex: "(^|\\s)" + escapeRegex(num) + "(\\s|$|\\.|,|\\)|/)", $options: 'i' } }));
    regexDbQuery = { 
      $text: { $search: searchNumbers.map(n => `"${n}"`).join(' ') },
      $or: regexQueries 
    };
  }

  console.log("Query from Text2:", JSON.stringify(regexDbQuery, null, 2));
  if (regexDbQuery) {
    const results = await AuctionNotice.find(regexDbQuery).select('sourceId name').limit(5).lean();
    console.log(`Found ${results.length} results from text2's numbers.`);
    results.forEach(r => console.log(` - ${r.sourceId}: ${r.name}`));
  }

  // Test from text1 to text2
  const dbQuery = { $text: { $search: text1 } };
  const text1Results = await AuctionNotice.find(dbQuery, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(300).select('sourceId name').lean();
  console.log(`\nFound ${text1Results.length} results from text1's full text search.`);
  const foundText2 = text1Results.find(r => r.sourceId === 570882);
  console.log("Did text1 search find text2 (570882)?", !!foundText2);

  process.exit(0);
}

testQuery().catch(console.error);
