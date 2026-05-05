const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("curl -v http://localhost:4321/api/auctions/412766 && tail -n 50 /root/.pm2/logs/daugia-backend-error*.log", (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data))
      .stderr.on('data', (data) => process.stderr.write(data));
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
