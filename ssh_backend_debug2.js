const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("cd /var/www/web-thong-ke-dau-gia/bot-crawls-data && node src/index.js > /tmp/out.log 2>&1", (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.exec("cat /tmp/out.log", (err, stream2) => {
        stream2.on('close', () => conn.end())
        .on('data', (data) => process.stdout.write(data));
      });
    });
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
