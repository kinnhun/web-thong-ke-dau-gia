const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected');
  // Run all commands, pipe output to a file, then cat it
  const cmd = `bash -c '
    pkill -9 -f chromium 2>/dev/null
    pkill -9 -f chrome 2>/dev/null  
    pkill -9 -f puppeteer 2>/dev/null
    echo "=== Killed zombie browser processes ==="
    
    export NVM_DIR="/root/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    
    pm2 stop thien-linh-an-fengshui 2>/dev/null
    pm2 delete thien-linh-an-fengshui 2>/dev/null
    echo "=== Stopped thienlinhan ==="
    
    echo "=== PM2 List ==="
    pm2 list
    
    echo "=== Memory ==="
    free -h
  '`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { conn.end(); })
      .on('data', (data) => { process.stdout.write(data.toString()); })
      .stderr.on('data', (data) => { process.stderr.write(data.toString()); });
  });
}).connect({
  host: '14.225.206.67', port: 22, username: 'root', password: 'WfHdCZSkSVa6OGg3c7Wf',
  readyTimeout: 60000,
});
