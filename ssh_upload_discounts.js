const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const filesToUpload = [
      {
        local: path.join(__dirname, 'src/domains/auction/auction.types.ts'),
        remote: '/var/www/web-thong-ke-dau-gia/src/domains/auction/auction.types.ts'
      },
      {
        local: path.join(__dirname, 'src/features/discounts/DiscountsContainer.tsx'),
        remote: '/var/www/web-thong-ke-dau-gia/src/features/discounts/DiscountsContainer.tsx'
      },
      {
        local: path.join(__dirname, 'src/features/relisted/RelistedContainer.tsx'),
        remote: '/var/www/web-thong-ke-dau-gia/src/features/relisted/RelistedContainer.tsx'
      }
    ];

    let uploadedCount = 0;

    filesToUpload.forEach(file => {
      sftp.fastPut(file.local, file.remote, (err) => {
        if (err) {
          console.error('Error uploading file:', file.local, err);
        } else {
          console.log('File uploaded successfully to', file.remote);
        }
        
        uploadedCount++;
        if (uploadedCount === filesToUpload.length) {
          console.log('All files uploaded. Building next.js...');
          conn.exec('bash -lc "cd /var/www/web-thong-ke-dau-gia && npm run build && pm2 restart daugia-frontend"', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
              console.log('Build and restart completed.');
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
