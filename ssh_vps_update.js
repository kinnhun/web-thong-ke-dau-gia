const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const filesToUpload = [
      'bot-crawls-data/src/utils/helpers.js',
      'bot-crawls-data/src/scrapers/detail.scraper.js',
      'bot-crawls-data/src/api/routes.js'
    ];

    let uploaded = 0;
    filesToUpload.forEach(file => {
      const localPath = `d:/web-thong-ke-dau-gia/${file}`;
      const remotePath = `/var/www/web-thong-ke-dau-gia/${file}`;
      
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) throw err;
        console.log(`Uploaded ${file}`);
        uploaded++;
        if (uploaded === filesToUpload.length) {
          console.log('All files uploaded. Restarting pm2...');
          const cmd = `cd /var/www/web-thong-ke-dau-gia && pm2 restart daugia-frontend daugia-backend crawl-extra mass-crawl-1 mass-crawl-2 mass-crawl-3 mass-crawl-4 mass-crawl-5 mass-crawl-6 mass-crawl-7 mass-crawl-8`;
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
        }
      });
    });
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
