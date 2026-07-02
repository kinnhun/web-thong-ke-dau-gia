const mongoose = require('mongoose');
const { extractPropertyIdentifiers, normalizeProvince, extractProvince } = require('../src/utils/helpers');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/thong_ke_dau_gia');
  console.log('Connected to Database.');

  const AuctionNotice = mongoose.model('AuctionNotice', new mongoose.Schema({}, { strict: false }));
  const OrgSelection = mongoose.model('OrgSelection', new mongoose.Schema({}, { strict: false }));

  console.log('Loading all records to build known geography maps...');
  const [auctions, orgs] = await Promise.all([
    AuctionNotice.find({}).select('sourceId province address name').lean(),
    OrgSelection.find({}).select('sourceId province address name').lean(),
  ]);

  const districtToProvinceMap = {};
  const communeToProvinceMap = {};

  const processItemForMaps = (item) => {
    const prov = normalizeProvince(item.province);
    if (!prov) return;

    const ids = extractPropertyIdentifiers(item.address || item.name);
    if (ids.district) {
      const distKey = ids.district.toLowerCase().trim();
      if (!districtToProvinceMap[distKey]) districtToProvinceMap[distKey] = new Set();
      districtToProvinceMap[distKey].add(prov);
    }
    if (ids.commune) {
      const commKey = ids.commune.toLowerCase().trim();
      if (!communeToProvinceMap[commKey]) communeToProvinceMap[commKey] = new Set();
      communeToProvinceMap[commKey].add(prov);
    }
  };

  auctions.forEach(processItemForMaps);
  orgs.forEach(processItemForMaps);

  // Filter to keep only unique mappings (1-to-1)
  const uniqueDistrictToProvince = {};
  for (const [dist, provs] of Object.entries(districtToProvinceMap)) {
    if (provs.size === 1) {
      uniqueDistrictToProvince[dist] = Array.from(provs)[0];
    }
  }

  const uniqueCommuneToProvince = {};
  for (const [comm, provs] of Object.entries(communeToProvinceMap)) {
    if (provs.size === 1) {
      uniqueCommuneToProvince[comm] = Array.from(provs)[0];
    }
  }

  console.log(`Geography Maps built:`);
  console.log(`- Unique districts: ${Object.keys(uniqueDistrictToProvince).length}`);
  console.log(`- Unique communes: ${Object.keys(uniqueCommuneToProvince).length}`);

  // Resolve AuctionNotice empty provinces
  const auctionOps = [];
  for (const item of auctions) {
    const prov = normalizeProvince(item.province);
    if (prov) continue;

    let resolvedProv = extractProvince(item.address || item.name);
    if (!resolvedProv) {
      const ids = extractPropertyIdentifiers(item.address || item.name);
      if (ids.district) {
        const distKey = ids.district.toLowerCase().trim();
        if (uniqueDistrictToProvince[distKey]) {
          resolvedProv = uniqueDistrictToProvince[distKey];
        }
      }
      if (!resolvedProv && ids.commune) {
        const commKey = ids.commune.toLowerCase().trim();
        if (uniqueCommuneToProvince[commKey]) {
          resolvedProv = uniqueCommuneToProvince[commKey];
        }
      }
    }

    if (resolvedProv) {
      auctionOps.push({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { province: resolvedProv } }
        }
      });
    }
  }

  // Resolve OrgSelection empty provinces
  const orgOps = [];
  for (const item of orgs) {
    const prov = normalizeProvince(item.province);
    if (prov) continue;

    let resolvedProv = extractProvince(item.address || item.name);
    if (!resolvedProv) {
      const ids = extractPropertyIdentifiers(item.address || item.name);
      if (ids.district) {
        const distKey = ids.district.toLowerCase().trim();
        if (uniqueDistrictToProvince[distKey]) {
          resolvedProv = uniqueDistrictToProvince[distKey];
        }
      }
      if (!resolvedProv && ids.commune) {
        const commKey = ids.commune.toLowerCase().trim();
        if (uniqueCommuneToProvince[commKey]) {
          resolvedProv = uniqueCommuneToProvince[commKey];
        }
      }
    }

    if (resolvedProv) {
      orgOps.push({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { province: resolvedProv } }
        }
      });
    }
  }

  console.log(`Updating ${auctionOps.length} AuctionNotices...`);
  if (auctionOps.length > 0) {
    const batchSize = 5000;
    for (let i = 0; i < auctionOps.length; i += batchSize) {
      const batch = auctionOps.slice(i, i + batchSize);
      await AuctionNotice.bulkWrite(batch, { ordered: false });
      console.log(`- Updated Auctions: ${Math.min(i + batchSize, auctionOps.length)}/${auctionOps.length}`);
    }
  }

  console.log(`Updating ${orgOps.length} OrgSelections...`);
  if (orgOps.length > 0) {
    const batchSize = 5000;
    for (let i = 0; i < orgOps.length; i += batchSize) {
      const batch = orgOps.slice(i, i + batchSize);
      await OrgSelection.bulkWrite(batch, { ordered: false });
      console.log(`- Updated Orgs: ${Math.min(i + batchSize, orgOps.length)}/${orgOps.length}`);
    }
  }

  console.log('Database geography cleanup finished successfully!');
  mongoose.connection.close();
}

run().catch(console.error);
