const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('cd /var/www/web-thong-ke-dau-gia && rm -rf .next/cache && pm2 restart daugia-frontend daugia-backend', (err, stream) => {
    if (err) throw err;
    stream.on('data', (data) => {
      console.log('OUTPUT:\n' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR:\n' + data);
    }).on('close', () => conn.end());
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
