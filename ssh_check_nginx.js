const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 list && cat /etc/nginx/sites-enabled/* | grep -i server_name -A 5', (err, stream) => {
    if (err) throw err;
    stream.on('data', d => console.log(''+d)).stderr.on('data', d => console.log(''+d)).on('close', () => conn.end());
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
