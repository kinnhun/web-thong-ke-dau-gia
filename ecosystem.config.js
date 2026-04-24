module.exports = {
  apps: [
    {
      name: 'daugia-frontend',
      script: 'npm',
      args: 'run start -- -p 1234',
      cwd: '/var/www/web-thong-ke-dau-gia',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      }
    },
    {
      name: 'daugia-backend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/web-thong-ke-dau-gia/bot-crawls-data',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        API_PORT: 4321
      }
    }
  ]
};
