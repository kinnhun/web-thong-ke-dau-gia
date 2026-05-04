const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const localFile = path.join(__dirname, 'bot-crawls-data/src/api/relisted.routes.js');
    const remoteFile = '/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/api/relisted.routes.js';
    
    sftp.fastPut(localFile, remoteFile, (err) => {
      if (err) {
        console.error('Error uploading file:', err);
        conn.end();
      } else {
        console.log('File uploaded successfully to ' + remoteFile);
        conn.exec('pm2 restart daugia-backend', (err, stream) => {
          if (err) throw err;
          stream.on('close', (code, signal) => {
            console.log('Restarted backend.');
            conn.end();
          }).on('data', (data) => {
            console.log('STDOUT: ' + data);
          }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
          });
        });
      }
    });
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
