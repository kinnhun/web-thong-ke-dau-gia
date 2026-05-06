const http = require('http');

const data = JSON.stringify({
  organizerName: "Trung tâm Dịch vụ bán đấu giá tài sản TPHCM"
});

const options = {
  hostname: 'localhost',
  port: 4321,
  path: '/api/trigger-organizer-duplicate-scan',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);

  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
