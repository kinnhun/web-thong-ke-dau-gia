const { Client } = require('ssh2');
const net = require('net');

const remoteHost = '14.225.206.67';
const remotePort = 27017;
const localPort = 27017;

// WARP/1.1.1.1 thường block port 22 nhưng cho qua port 443
const SSH_PORTS = [22, 443];
let currentPortIndex = 0;
let tcpServer = null;

function getCurrentPort() {
  return SSH_PORTS[currentPortIndex % SSH_PORTS.length];
}

function switchPort() {
  currentPortIndex = (currentPortIndex + 1) % SSH_PORTS.length;
  return SSH_PORTS[currentPortIndex];
}

function createTunnel() {
  const sshPort = getCurrentPort();
  const conn = new Client();

  console.log(`🔌 Trying SSH on port ${sshPort}...`);

  conn.on('ready', () => {
    console.log(`✅ SSH Connected on port ${sshPort}. Starting tunnel...`);

    // Đóng server cũ nếu còn
    if (tcpServer) {
      try { tcpServer.close(); } catch (e) {}
      tcpServer = null;
    }

    tcpServer = net.createServer((sock) => {
      conn.forwardOut(
        '127.0.0.1', sock.remotePort || 0,
        '127.0.0.1', remotePort,
        (err, stream) => {
          if (err) {
            console.error('❌ Tunnel error:', err.message);
            return sock.end();
          }
          sock.on('error', () => stream.end());
          stream.on('error', () => sock.end());
          sock.pipe(stream).pipe(sock);
        }
      );
    }).listen(localPort, '127.0.0.1', () => {
      console.log(`🚀 Tunnel active: localhost:${localPort} -> ${remoteHost}:${remotePort} (via SSH:${sshPort})`);
    });

    tcpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`ℹ️  Port ${localPort} already in use - tunnel may already be running`);
      } else {
        console.error('❌ Server error:', err.message);
      }
    });
  });

  conn.on('error', (err) => {
    console.error(`❌ SSH port ${sshPort} failed: ${err.message}`);
    const next = switchPort();
    console.log(`🔄 Switching to port ${next}, retrying in 3 seconds...`);
    setTimeout(createTunnel, 3000);
  });

  conn.on('close', () => {
    console.log(`⚠️ SSH Connection (port ${sshPort}) closed. Reconnecting in 5 seconds...`);
    setTimeout(createTunnel, 5000);
  });

  conn.connect({
    host: remoteHost,
    port: sshPort,
    username: 'root',
    password: 'WfHdCZSkSVa6OGg3c7Wf',
    readyTimeout: 15000,       // 15s timeout -> nhanh chóng fallback sang port khác
    keepaliveInterval: 10000,
  });
}

createTunnel();
