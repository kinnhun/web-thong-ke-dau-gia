fetch('http://14.225.206.67:4321/api/trigger-scan-duplicate-item', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sourceId: 562920, type: 'auction' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
