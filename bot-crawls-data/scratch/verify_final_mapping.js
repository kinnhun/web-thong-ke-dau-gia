const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('thong_ke_dau_gia');

  console.log('\n=========================================');
  console.log('VERIFYING CASE 1: CMTT PROPERTY (959 Cách Mạng Tháng Tám)');
  
  const cmttNotices = await db.collection('auctionnotices')
    .find({ province: 'TP. Hồ Chí Minh', name: /Cách Mạng Tháng Tám/i, name: /959/ })
    .project({ sourceId: 1, name: 1, rootId: 1 })
    .toArray();

  console.log(`Found ${cmttNotices.length} notices for CMTT:`);
  const cmttGroupMap = {};
  cmttNotices.forEach(n => {
    const rId = n.rootId ? n.rootId.toString() : 'null';
    if (!cmttGroupMap[rId]) cmttGroupMap[rId] = [];
    cmttGroupMap[rId].push(n.sourceId);
  });
  console.log('Duplicate Groups for CMTT:', cmttGroupMap);

  console.log('\n=========================================');
  console.log('VERIFYING CASE 2: DONG NAI VEHICLE (93A-369.36)');
  const vehicleNotices = await db.collection('auctionnotices')
    .find({ name: /93A/i, name: /369/ })
    .project({ sourceId: 1, name: 1, rootId: 1 })
    .toArray();

  console.log(`Found ${vehicleNotices.length} notices for vehicle 93A-369.36:`);
  const vehicleGroupMap = {};
  vehicleNotices.forEach(n => {
    const rId = n.rootId ? n.rootId.toString() : 'null';
    if (!vehicleGroupMap[rId]) vehicleGroupMap[rId] = [];
    vehicleGroupMap[rId].push(n.sourceId);
  });
  console.log('Duplicate Groups for Vehicle:', vehicleGroupMap);

  console.log('\n=========================================');
  console.log('VERIFYING CASE 3: NAM DINH KI-OT (Chợ Rồng)');
  const kioskNotices = await db.collection('auctionnotices')
    .find({ province: 'Nam Định', name: /Chợ Rồng/i, name: /11/ })
    .project({ sourceId: 1, name: 1, rootId: 1 })
    .toArray();

  console.log(`Found ${kioskNotices.length} notices for Chợ Rồng:`);
  const kioskGroupMap = {};
  kioskNotices.forEach(n => {
    const rId = n.rootId ? n.rootId.toString() : 'null';
    if (!kioskGroupMap[rId]) kioskGroupMap[rId] = [];
    kioskGroupMap[rId].push(n.sourceId);
  });
  console.log('Duplicate Groups for Kiosk:', kioskGroupMap);

  client.close();
}

run().catch(console.error);
