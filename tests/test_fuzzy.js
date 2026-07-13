const mongoose = require('mongoose');
const AuctionNotice = require('./bot-crawls-data/src/models/AuctionNotice');

function getBigrams(str) {
  if (!str) return new Set();
  const clean = str.toLowerCase().replace(/[,\.\(\):\-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  const bigrams = new Set();
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]} ${words[i+1]}`);
  }
  if (words.length === 1) bigrams.add(words[0]);
  return bigrams;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersectionSize = 0;
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

mongoose.connect('mongodb://localhost:27017/thong_ke_dau_gia').then(async () => {
  console.log("Fetching items with Lê Quang Sung...");
  const items = await AuctionNotice.find({ name: /Lê Quang Sung/i }).select('sourceId name province').lean();
  
  // precalculate bigrams
  const data = items.map(i => ({
    sourceId: i.sourceId,
    name: i.name,
    bigrams: getBigrams(i.name)
  }));

  console.log(`Found ${data.length} items. Calculating Jaccard > 0.70...`);
  
  const edges = [];
  let checks = 0;
  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      checks++;
      const sim = jaccardSimilarity(data[i].bigrams, data[j].bigrams);
      if (sim >= 0.70) {
        edges.push([i, j, sim]);
      }
    }
  }

  console.log(`Did ${checks} checks. Found ${edges.length} matching pairs.`);
  
  // Union find
  const parent = Array.from({length: data.length}, (_, i) => i);
  const find = (i) => {
    if (parent[i] === i) return i;
    return parent[i] = find(parent[i]);
  };
  const union = (i, j) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  };

  for (const [i, j] of edges) union(i, j);

  const groups = {};
  for (let i = 0; i < data.length; i++) {
    const root = find(i);
    if (!groups[root]) groups[root] = [];
    groups[root].push(data[i]);
  }

  console.log(`Total groups: ${Object.keys(groups).length}`);
  for (const root in groups) {
    console.log(`\n=== GROUP (${groups[root].length} items) ===`);
    groups[root].forEach(item => {
      console.log(`- ${item.name}`);
    });
  }

  process.exit(0);
}).catch(console.error);
