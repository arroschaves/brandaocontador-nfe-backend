module.exports = {
  apps: [{
    name: 'nfe-backend',
    script: 'app.js',
    cwd: '/var/www/brandaocontador-nfe-backend',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/brandaocontador-nfe-backend/error.log',
    out_file: '/var/log/brandaocontador-nfe-backend/out.log',
    log_file: '/var/log/brandaocontador-nfe-backend/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'temp'],
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    listen_timeout: 8000,
    shutdown_with_message: true,
    wait_ready: true
  }]
};