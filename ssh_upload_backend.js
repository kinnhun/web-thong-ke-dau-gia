const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const file1 = {
      local: path.join(__dirname, 'bot-crawls-data/src/scrapers/detail.scraper.js'),
      remote: '/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/scrapers/detail.scraper.js'
    };
    const file2 = {
      local: path.join(__dirname, 'bot-crawls-data/src/utils/helpers.js'),
      remote: '/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/utils/helpers.js'
    };
    const file3 = {
      local: path.join(__dirname, 'bot-crawls-data/src/api/routes.js'),
      remote: '/var/www/web-thong-ke-dau-gia/bot-crawls-data/src/api/routes.js'
    };

    sftp.fastPut(file1.local, file1.remote, (err) => {
      if (err) console.error(err);
      sftp.fastPut(file2.local, file2.remote, (err) => {
        if (err) console.error(err);
        sftp.fastPut(file3.local, file3.remote, (err) => {
          if (err) console.error(err);
          console.log('Files uploaded successfully. Restarting backend...');
          conn.exec('pm2 restart daugia-backend', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
              console.log('Backend restarted.');
              conn.end();
            }).on('data', (data) => {
              process.stdout.write(data);
            }).stderr.on('data', (data) => {
              process.stderr.write(data);
            });
          });
        });
      });
    });
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
