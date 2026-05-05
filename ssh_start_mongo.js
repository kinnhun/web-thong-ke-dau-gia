const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected');
  conn.exec('systemctl start mongod || systemctl start mongodb', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { console.log('Done starting Mongo'); conn.end(); })
      .on('data', (data) => process.stdout.write('' + data))
      .stderr.on('data', (data) => process.stderr.write('' + data));
  });
}).connect({
  host: '14.225.206.67', port: 22, username: 'root', password: 'WfHdCZSkSVa6OGg3c7Wf',
  readyTimeout: 60000,
});
