const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('pm2 info daugia-backend | grep "script path"', (err, stream) => {
    if (err) throw err;
    stream.on('data', (data) => {
      console.log('Script path: ' + data);
    }).on('close', () => conn.end());
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
