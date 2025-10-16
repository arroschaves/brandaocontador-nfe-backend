module.exports = {
  apps: [{
    name: 'brandaocontador-nfe-backend',
    script: './app-real.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
  env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      // Seed admin via env
      SEED_ADMIN_NOME: 'Brandao Contabilidade',
      SEED_ADMIN_EMAIL: 'cjbrandaibrandaocontador.com.br',
      SEED_ADMIN_SENHA: '@Pa2684653#',
      SIMULATION_MODE: 'false'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};