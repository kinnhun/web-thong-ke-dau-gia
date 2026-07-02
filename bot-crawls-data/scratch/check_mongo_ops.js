const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../src/db');

async function run() {
  await connectDB();

  const admin = mongoose.connection.db.admin();
  const status = await admin.serverStatus();
  console.log(`Uptime: ${status.uptime}s`);
  console.log(`Connections: current=${status.connections.current}, available=${status.connections.available}`);

  console.log('--- Active Operations ---');
  const adminDb = mongoose.connection.client.db('admin');
  const ops = await adminDb.command({ currentOp: 1, active: true });
  if (Array.isArray(ops.inprog)) {
    ops.inprog.forEach(op => {
      console.log(`OpID: ${op.opid}, Op: ${op.op}, NS: ${op.ns}, Secs: ${op.secs_running}s, Msg: ${op.msg || 'N/A'}`);
      if (op.query) console.log('Query:', JSON.stringify(op.query));
    });
  }

  await closeDB();
}

run().catch(console.error);
