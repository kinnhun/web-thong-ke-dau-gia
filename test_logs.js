const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  const cmd = `curl -s http://localhost:4321/api/auctions?limit=1 | grep -o "items"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT:\n' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR:\n' + data);
    });
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf',
  readyTimeout: 60000,
  keepaliveInterval: 10000
});
