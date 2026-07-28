module.exports = {
  apps: [
    {
      name: 'wom-hiscores',
      cwd: __dirname,
      script: 'npm',
      args: 'start -- --host 0.0.0.0 --port 4200',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: '4200'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '4200'
      }
    }
  ]
};
