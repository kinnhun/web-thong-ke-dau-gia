const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("cd /var/www/web-thong-ke-dau-gia/bot-crawls-data && node --max-old-space-size=2048 src/index.js", (err, stream) => {
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
