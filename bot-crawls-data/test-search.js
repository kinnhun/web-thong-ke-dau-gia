const {connectDB}=require('./src/db');
const Duplicate=require('./src/models/Duplicate');
connectDB().then(async () => {
  const keyword = "Lê Quang Sung";
  const a = await Duplicate.find({ $text: { $search: `"${keyword}"` } }).limit(5).select('sourceIds');
  console.log(a.map(d => d.sourceIds));
  process.exit(0);
});
