const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      try {
        const apps = JSON.parse(data);
        apps.forEach(app => {
          console.log(`App: ${app.name}, Path: ${app.pm2_env.pm_cwd}`);
        });
      } catch(e) {
        console.log("Raw output:", data);
      }
      conn.end();
    }).on('data', (d) => {
      data += d;
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '14.225.206.67',
  port: 22,
  username: 'root',
  password: 'WfHdCZSkSVa6OGg3c7Wf'
});
