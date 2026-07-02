const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4321,
  path: '/api/trigger-duplicate-scan',
  method: 'POST',
  headers: {
    'Content-Length': 0
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

req.end();
