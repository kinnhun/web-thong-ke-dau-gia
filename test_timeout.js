const start = Date.now();
fetch('http://14.225.206.67:1234/api/relisted?page=1&limit=20&status=completed&sort=rounds_desc')
  .then(res => res.json())
  .then(data => {
    console.log('Time:', Date.now() - start, 'ms');
    console.log('Items:', data.items?.length);
  })
  .catch(console.error);
