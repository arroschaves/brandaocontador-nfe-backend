module.exports = {
  apps: [
    {
      name: "brandaocontador-nfe-backend-prod",
      script: "./app.js",
      cwd: "/var/www/brandaocontador-nfe-backend",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env_file: ".env",
      env: {
        NODE_ENV: "production",
        AMBIENTE: "1",
        SIMULATION_MODE: "false",
        PORT: 3001,
        ENABLE_AUTO_SEED: "true"
      },
      // Configurações de produção
      max_memory_restart: "1G",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      
      // Auto restart em caso de falha
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      
      // Configurações de cluster (opcional)
      // instances: "max",
      // exec_mode: "cluster",
      
      // Configurações de monitoramento
      monitoring: false,
      pmx: false,
      
      // Configurações de deploy (opcional)
      deploy: {
        production: {
          user: "deploy",
          host: ["seu-servidor.com"],
          ref: "origin/main",
          repo: "git@github.com:seu-usuario/brandaocontador-nfe.git",
          path: "/var/www/brandaocontador-nfe-backend",
          "post-deploy": "npm install && pm2 reload ecosystem.production.js --env production"
        }
      }
    }
  ]
};