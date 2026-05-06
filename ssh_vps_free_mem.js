const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  // Lệnh dừng các mass-crawl, xóa cache RAM, và khởi động lại backend, frontend
  const cmd = `pm2 stop mass-crawl-1 mass-crawl-2 mass-crawl-3 mass-crawl-4 mass-crawl-5 mass-crawl-6 mass-crawl-7 mass-crawl-8 crawl-extra && sync; echo 3 > /proc/sys/vm/drop_caches && pm2 restart daugia-backend daugia-frontend`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
