/**
 * Localhost.run Tunnel wrapper
 * - Tự động bật WARP 1.1.1.1 (để cào web không bị chặn IP)
 * - Dùng localhost.run qua SSH để tạo Tunnel (vượt lỗi 500 của Cloudflare, không bị màn hình chờ như localtunnel)
 * - Ghi URL vào file .tunnel-url để admin page có thể đọc
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TUNNEL_URL_FILE = path.join(__dirname, '.tunnel-url');
const LOCAL_PORT = 1234;
let retryCount = 0;

function startWarp() {
  try {
    console.log('🛡️ Bật 1.1.1.1 WARP để cào dữ liệu...');
    execSync('warp-cli connect', { stdio: 'ignore' });
    return new Promise(resolve => setTimeout(resolve, 3000));
  } catch (err) {
    console.log('⚠️ Không thể tự động bật WARP. Bạn có thể cần tự bật bằng tay.');
    return Promise.resolve();
  }
}

async function startTunnel() {
  retryCount++;
  console.log(`🔌 [Attempt ${retryCount}] Starting Tunnel (localhost.run)...`);
  
  if (retryCount === 1) {
    await startWarp();
  }

  try { fs.unlinkSync(TUNNEL_URL_FILE); } catch (e) {}

  // Chạy ssh tunnel tới localhost.run
  const child = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-R', `80:localhost:${LOCAL_PORT}`, 'nokey@localhost.run'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let urlFound = false;
  let lastError = '';

  function handleOutput(data) {
    const text = data.toString();
    const lines = text.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      if (line.includes('ERR') || line.toLowerCase().includes('error')) {
        lastError = line.trim();
        console.error(`  ❌ ${lastError}`);
      }
    }
    
    // Extract URL (localhost.run trả về dạng https://*.lhr.life)
    const urlMatch = text.match(/https:\/\/[a-zA-Z0-9\-]+\.lhr\.life/);
    if (urlMatch && !urlFound) {
      urlFound = true;
      const url = urlMatch[0];
      fs.writeFileSync(TUNNEL_URL_FILE, url, 'utf8');
      console.log(`🚀 Tunnel URL: ${url}`);
      console.log(`📋 URL saved to .tunnel-url`);
      retryCount = 0;
    }
  }

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('error', (err) => {
    console.error('❌ Tunnel spawn error:', err.message);
  });

  child.on('exit', (code) => {
    const delay = Math.min(5000 * retryCount, 30000);
    if (lastError) {
      console.log(`⚠️ Tunnel exited (code ${code}): ${lastError}`);
    } else {
      console.log(`⚠️ Tunnel exited (code ${code}).`);
    }
    console.log(`🔄 Retrying in ${delay / 1000}s...`);
    
    try { fs.unlinkSync(TUNNEL_URL_FILE); } catch (e) {}
    setTimeout(startTunnel, delay);
  });

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
