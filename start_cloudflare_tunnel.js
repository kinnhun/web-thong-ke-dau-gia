/**
 * Cloudflare Tunnel wrapper
 * - Chạy cloudflared tunnel → capture URL
 * - Ghi URL vào file .tunnel-url để admin page có thể đọc
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TUNNEL_URL_FILE = path.join(__dirname, '.tunnel-url');
const LOCAL_PORT = 1234;
let retryCount = 0;

// Tìm binary cloudflared từ node_modules
function findCloudflaredBin() {
  try {
    const cloudflared = require('cloudflared');
    if (cloudflared.bin && fs.existsSync(cloudflared.bin)) return cloudflared.bin;
  } catch (e) {}
  
  // Fallback: global
  return 'cloudflared';
}

function startTunnel() {
  const bin = findCloudflaredBin();
  retryCount++;
  console.log(`🔌 [Attempt ${retryCount}] Starting Cloudflare Tunnel...`);
  
  // Xóa URL cũ
  try { fs.unlinkSync(TUNNEL_URL_FILE); } catch (e) {}

  const child = spawn(bin, ['tunnel', '--url', `http://localhost:${LOCAL_PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let urlFound = false;
  let lastError = '';

  function handleOutput(data) {
    const text = data.toString();
    
    // Log tất cả output để debug
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      // Bỏ qua log dài/spam
      if (line.includes('INF ')) {
        const msg = line.replace(/^.*INF /, '').trim();
        if (msg && !msg.includes('Registered tunnel connection')) {
          console.log(`  ℹ️  ${msg}`);
        }
      }
      if (line.includes('ERR ')) {
        lastError = line.replace(/^.*ERR /, '').trim();
        console.error(`  ❌ ${lastError}`);
      }
    }
    
    // Extract URL
    const urlMatch = text.match(/https:\/\/[a-zA-Z0-9\-]+\.trycloudflare\.com/);
    if (urlMatch && !urlFound) {
      urlFound = true;
      const url = urlMatch[0];
      fs.writeFileSync(TUNNEL_URL_FILE, url, 'utf8');
      console.log(`🚀 Tunnel URL: ${url}`);
      console.log(`📋 URL saved to .tunnel-url`);
      retryCount = 0; // Reset retry count on success
    }
  }

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('error', (err) => {
    console.error('❌ Cloudflare tunnel spawn error:', err.message);
  });

  child.on('exit', (code) => {
    const delay = Math.min(5000 * retryCount, 30000); // Backoff: 5s, 10s, 15s... max 30s
    if (lastError) {
      console.log(`⚠️ Tunnel exited (code ${code}): ${lastError}`);
    } else {
      console.log(`⚠️ Tunnel exited (code ${code}).`);
    }
    console.log(`🔄 Retrying in ${delay / 1000}s...`);
    
    // Xóa URL file khi tunnel chết
    try { fs.unlinkSync(TUNNEL_URL_FILE); } catch (e) {}
    setTimeout(startTunnel, delay);
  });

  // Graceful shutdown
  const cleanup = () => {
    child.kill();
    try { fs.unlinkSync(TUNNEL_URL_FILE); } catch (e) {}
    process.exit(0);
  };
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startTunnel();
