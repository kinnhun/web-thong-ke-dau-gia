const http = require('http');

const targetIds = [566731, 241186, 268652, 466453, 566714];

function fetchId(id) {
  return new Promise((resolve) => {
    console.log(`Sending live-scrape request for ID: ${id}...`);
    http.get(`http://localhost:4321/api/auctions/${id}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`ID #${id} Response Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(`   Name: "${json.name}"`);
        } catch (e) {
          console.log(`   Failed to parse response: ${data.slice(0, 100)}`);
        }
        resolve();
      });
    }).on('error', (err) => {
      console.error(`Error requesting ID #${id}:`, err.message);
      resolve();
    });
  });
}

async function run() {
  for (const id of targetIds) {
    await fetchId(id);
    // Add a small delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\nAll requests completed!');
}

run();
