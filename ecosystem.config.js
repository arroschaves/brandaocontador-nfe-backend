module.exports = {
  apps: [{
    name: 'nfe-backend',
    script: 'app.js',
    cwd: '/var/www/brandaocontador-nfe-backend',
    instances: 4, // Otimizado para 4 instâncias em vez de 'max' (6 cores)
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      AMBIENTE: '1', // Produção por padrão
      SIMULATION_MODE: 'false',
      DEBUG_MODE: 'false'
    },
    env_homologacao: {
      NODE_ENV: 'production',
      PORT: 3000,
      AMBIENTE: '2', // Homologação
      SIMULATION_MODE: 'false',
      DEBUG_MODE: 'true'
    },
    error_file: '/var/log/brandaocontador-nfe-backend/error.log',
    out_file: '/var/log/brandaocontador-nfe-backend/out.log',
    log_file: '/var/log/brandaocontador-nfe-backend/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024 --optimize-for-size',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'temp', 'certs'],
    max_restarts: 5, // Reduzido para evitar restart loops
    min_uptime: '30s', // Aumentado para garantir estabilidade
    kill_timeout: 5000,
    listen_timeout: 8000,
    shutdown_with_message: true,
    wait_ready: true,
    // Configurações adicionais para estabilidade
    autorestart: true,
    restart_delay: 4000,
    exp_backoff_restart_delay: 100
  }]
};