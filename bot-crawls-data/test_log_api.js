async function getLogs() {
  try {
    const res = await fetch('http://localhost:4321/api/crawl-logs?limit=5');
    const data = await res.json();
    const dupLogs = data.logs.filter(l => l.type === 'duplicate_scan');
    dupLogs.forEach(l => {
      console.log(`\nLog ID: ${l._id}`);
      console.log(`Time: ${l.startedAt}`);
      console.log(`Status: ${l.status}`);
      console.log(`Items Updated: ${l.itemsUpdated}`);
      console.log(`Messages:`, l.errorMessages);
    });
  } catch (err) {
    console.error(err.message);
  }
}
getLogs();
