const http = require('http');

function postTrigger(sourceId) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ sourceId, type: 'auction' });
    console.log(`Sending duplicate scan trigger for ID: ${sourceId}...`);
    
    const req = http.request({
      hostname: 'localhost',
      port: 4321,
      path: '/api/trigger-scan-duplicate-item',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        console.log(`ID #${sourceId} Response Status: ${res.statusCode}`);
        console.log(`Response: ${respData}`);
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error(`Error requesting ID #${sourceId}:`, err.message);
      resolve();
    });

    req.write(data);
    req.end();
  });
}

async function run() {
  // Trigger duplicate scan for case 1 and case 2 representative IDs
  await postTrigger(566731);
  await new Promise(r => setTimeout(r, 3000));
  await postTrigger(268652);
  await new Promise(r => setTimeout(r, 3000));
  console.log('\nAll triggers sent!');
}

run();
