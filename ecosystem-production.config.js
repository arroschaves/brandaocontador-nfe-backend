// ============================================================================
// CONFIGURAÇÃO PM2 PARA SISTEMA NFE - SERVIDOR CONTABO
// ============================================================================
// Servidor: 147.93.186.214 (Ubuntu 24.04.3 LTS)
// Aplicação: Sistema NFe em produção
// Usuário: nfeapp
// ============================================================================

module.exports = {
  apps: [
    {
      // ========================================================================
      // CONFIGURAÇÕES BÁSICAS
      // ========================================================================
      name: "nfe-api",
      script: "app.js",
      cwd: "/var/www/nfe/backend",

      // ========================================================================
      // CONFIGURAÇÕES DE CLUSTER
      // ========================================================================
      instances: 2, // 2 instâncias para aproveitar múltiplos cores
      exec_mode: "cluster",

      // ========================================================================
      // VARIÁVEIS DE AMBIENTE
      // ========================================================================
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",
      },

      // ========================================================================
      // CONFIGURAÇÕES DE LOGS
      // ========================================================================
      error_file: "/var/log/nfe/pm2-err.log",
      out_file: "/var/log/nfe/pm2-out.log",
      log_file: "/var/log/nfe/pm2-combined.log",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // ========================================================================
      // CONFIGURAÇÕES DE MEMÓRIA E PERFORMANCE
      // ========================================================================
      max_memory_restart: "500M", // Restart se usar mais de 500MB
      node_args: [
        "--max-old-space-size=512", // Limite de memória Node.js
        "--optimize-for-size", // Otimizar para uso de memória
      ],

      // ========================================================================
      // CONFIGURAÇÕES DE RESTART
      // ========================================================================
      watch: false, // Não usar watch em produção
      ignore_watch: [
        "node_modules",
        "logs",
        "uploads",
        "data",
        "certificates",
        "*.log",
      ],
      restart_delay: 4000, // Aguardar 4s antes de restart
      max_restarts: 10, // Máximo 10 restarts por minuto
      min_uptime: "10s", // Mínimo 10s rodando para considerar estável
      kill_timeout: 5000, // Timeout para kill graceful
      listen_timeout: 3000, // Timeout para listen
      wait_ready: true, // Aguardar sinal de ready

      // ========================================================================
      // CONFIGURAÇÕES DE AUTORELOAD
      // ========================================================================
      autorestart: true,

      // ========================================================================
      // CONFIGURAÇÕES DE CRON (OPCIONAL)
      // ========================================================================
      cron_restart: "0 2 * * *", // Restart diário às 2h da manhã

      // ========================================================================
      // CONFIGURAÇÕES DE MONITORAMENTO
      // ========================================================================
      pmx: true,

      // ========================================================================
      // CONFIGURAÇÕES AVANÇADAS
      // ========================================================================
      source_map_support: false, // Desabilitar em produção
      instance_var: "INSTANCE_ID",

      // ========================================================================
      // CONFIGURAÇÕES DE DEPLOY (OPCIONAL)
      // ========================================================================
      post_update: ["npm install --production", 'echo "Deploy concluído"'],

      // ========================================================================
      // CONFIGURAÇÕES DE ERRO
      // ========================================================================
      exp_backoff_restart_delay: 100,

      // ========================================================================
      // CONFIGURAÇÕES DE AMBIENTE ESPECÍFICAS
      // ========================================================================
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",
        LOG_LEVEL: "error",
        METRICS_ENABLED: "false",
      },
    },
  ],

  // ============================================================================
  // CONFIGURAÇÕES DE DEPLOY
  // ============================================================================
  deploy: {
    production: {
      user: "nfeapp",
      host: "147.93.186.214",
      ref: "origin/main",
      repo: "git@github.com:seu-usuario/nfe-backend.git",
      path: "/var/www/nfe",
      "pre-deploy-local": "",
      "post-deploy":
        "npm install --production && pm2 reload ecosystem-production.config.js --env production",
      "pre-setup": "",
    },
  },

  // ============================================================================
  // CONFIGURAÇÕES GLOBAIS DO PM2
  // ============================================================================

  // Configurações de monitoramento
  monitoring: {
    http: true,
    https: false,
    port: 9615,
  },

  // Configurações de logs
  log_type: "json",

  // Configurações de performance
  max_memory_restart: "500M",

  // Configurações de cluster
  instances_var: "INSTANCES",

  // ============================================================================
  // SCRIPTS AUXILIARES
  // ============================================================================
  scripts: {
    start: "pm2 start ecosystem-production.config.js --env production",
    stop: "pm2 stop nfe-api",
    restart: "pm2 restart nfe-api",
    reload: "pm2 reload nfe-api",
    delete: "pm2 delete nfe-api",
    status: "pm2 status",
    logs: "pm2 logs nfe-api",
    monit: "pm2 monit",
    save: "pm2 save",
    resurrect: "pm2 resurrect",
  },
};

// ============================================================================
// CONFIGURAÇÕES ADICIONAIS PARA DIFERENTES AMBIENTES
// ============================================================================

// Configuração para desenvolvimento (se necessário)
const developmentConfig = {
  name: "nfe-api-dev",
  script: "app.js",
  instances: 1,
  exec_mode: "fork",
  watch: true,
  env: {
    NODE_ENV: "development",
    PORT: 3001,
  },
};

// Configuração para staging (se necessário)
const stagingConfig = {
  name: "nfe-api-staging",
  script: "app.js",
  instances: 1,
  exec_mode: "cluster",
  env: {
    NODE_ENV: "staging",
    PORT: 3002,
  },
};

// Exportar configurações adicionais se necessário
// module.exports.apps.push(developmentConfig);
// module.exports.apps.push(stagingConfig);
