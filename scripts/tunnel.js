/**
 * Cloudflare Tunnel wrapper
 * Chạy cloudflared và capture URL → ghi vào .tunnel-url
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TUNNEL_FILE = path.join(__dirname, '..', '.tunnel-url');
const PORT = process.env.PORT || 1234;

// Xóa file cũ khi bắt đầu
try { fs.unlinkSync(TUNNEL_FILE); } catch {}

console.log(`[TUNNEL] Starting cloudflared tunnel → http://localhost:${PORT}`);

const child = spawn('npx', ['-y', 'cloudflared', 'tunnel', '--protocol', 'http2', '--edge-ip-version', '4', '--url', `http://127.0.0.1:${PORT}`], {
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let urlFound = false;

function parseLine(line) {
  // Cloudflared output URL dạng: https://xxx.trycloudflare.com
  const urlMatch = line.match(/(https?:\/\/[a-z0-9-]+\.trycloudflare\.com\S*)/i);
  if (urlMatch && !urlFound) {
    urlFound = true;
    const url = urlMatch[1].replace(/\|$/, '').trim();
    fs.writeFileSync(TUNNEL_FILE, url, 'utf8');
    console.log(`[TUNNEL] ✅ URL captured: ${url}`);
    console.log(`[TUNNEL] Written to: ${TUNNEL_FILE}`);
  }
}

child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      process.stdout.write(`[tunnel] ${line}\n`);
      parseLine(line);
    }
  }
});

child.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      // Cloudflared thường output URL qua stderr
      process.stderr.write(`[tunnel] ${line}\n`);
      parseLine(line);
    }
  }
});

child.on('close', (code) => {
  console.log(`[TUNNEL] Process exited with code ${code}`);
  // Xóa file khi tunnel tắt
  try { fs.unlinkSync(TUNNEL_FILE); } catch {}
});

child.on('error', (err) => {
  console.error(`[TUNNEL] Error: ${err.message}`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  child.kill();
  try { fs.unlinkSync(TUNNEL_FILE); } catch {}
  process.exit(0);
});

process.on('SIGTERM', () => {
  child.kill();
  try { fs.unlinkSync(TUNNEL_FILE); } catch {}
  process.exit(0);
});
