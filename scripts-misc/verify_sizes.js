const mongoose = require('mongoose');
const config = require('./bot-crawls-data/src/config');
const Duplicate = require('./bot-crawls-data/src/models/Duplicate');

async function checkSizes() {
  await mongoose.connect(config.mongo.uri);
  console.log("Connected to DB.");

  const total = await Duplicate.countDocuments();
  console.log(`Total duplicate groups: ${total}`);

  // Fetch groups with size > 10
  const largeGroups = await Duplicate.find({
    $expr: { $gt: [{ $size: "$sourceIds" }, 10] }
  }).sort({ relistCount: -1 }).limit(20).lean();

  console.log("\n=== TOP 20 LARGEST GROUPS ===");
  largeGroups.forEach((g, i) => {
    console.log(`${i+1}. Name: "${g.name}" | Size: ${g.sourceIds.length} | Province: ${g.province} | District: ${g.district}`);
  });

  // Size distribution
  const distribution = {
    "size_2": 0,
    "size_3": 0,
    "size_4": 0,
    "size_5_10": 0,
    "size_11_20": 0,
    "size_gt_20": 0
  };

  const cursor = Duplicate.find({}, { sourceIds: 1 }).lean().cursor();
  let doc;
  while ((doc = await cursor.next())) {
    const size = doc.sourceIds.length;
    if (size === 2) distribution.size_2++;
    else if (size === 3) distribution.size_3++;
    else if (size === 4) distribution.size_4++;
    else if (size <= 10) distribution.size_5_10++;
    else if (size <= 20) distribution.size_11_20++;
    else distribution.size_gt_20++;
  }

  console.log("\n=== SIZE DISTRIBUTION ===");
  console.log(JSON.stringify(distribution, null, 2));

  await mongoose.disconnect();
}

checkSizes().catch(console.error);
