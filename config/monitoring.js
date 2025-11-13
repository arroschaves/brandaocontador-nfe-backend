// ==================== CONFIGURAÇÃO DE MONITORAMENTO ====================
// Sistema completo de monitoramento, métricas e performance para NFe

const path = require("path");

const monitoringConfig = {
  // ==================== CONFIGURAÇÕES GERAIS ====================
  enabled: process.env.MONITORING_ENABLED !== "false",
  environment: process.env.NODE_ENV || "development",

  // ==================== CONFIGURAÇÕES DE LOGS ====================
  logging: {
    level: process.env.LOG_LEVEL || "info",
    format: process.env.LOG_FORMAT || "json", // json, simple
    directory: path.join(__dirname, "../logs"),
    maxFiles: process.env.LOG_MAX_FILES || "14d",
    maxSize: process.env.LOG_MAX_SIZE || "20m",

    // Configurações específicas por tipo
    files: {
      combined: "combined-%DATE%.log",
      error: "error-%DATE%.log",
      security: "security-%DATE%.log",
      performance: "performance-%DATE%.log",
      nfe: "nfe-%DATE%.log",
    },
  },

  // ==================== CONFIGURAÇÕES DE MÉTRICAS ====================
  metrics: {
    enabled: process.env.METRICS_ENABLED !== "false",
    endpoint: "/metrics",
    collectDefaultMetrics: true,
    prefix: "nfe_backend_",

    // Configurações de coleta
    collection: {
      interval: parseInt(process.env.METRICS_INTERVAL) || 5000, // 5 segundos
      timeout: parseInt(process.env.METRICS_TIMEOUT) || 10000, // 10 segundos
    },

    // Métricas customizadas para NFe
    custom: {
      nfe_requests_total: "Contador total de requisições NFe",
      nfe_requests_duration: "Duração das requisições NFe",
      nfe_errors_total: "Contador total de erros NFe",
      sefaz_response_time: "Tempo de resposta do SEFAZ",
      certificate_expiry_days: "Dias até expiração do certificado",
      database_connections: "Conexões ativas do banco de dados",
      memory_usage_bytes: "Uso de memória em bytes",
      cpu_usage_percent: "Uso de CPU em porcentagem",
    },
  },

  // ==================== CONFIGURAÇÕES DE HEALTH CHECK ====================
  health: {
    endpoint: "/health",
    detailed: "/health/detailed",
    timeout: parseInt(process.env.HEALTH_TIMEOUT) || 5000,

    // Verificações essenciais apenas
    checks: {
      database: false, // Simplificado - não verificar banco
      sefaz: false, // Simplificado - não verificar SEFAZ
      certificate: false, // Simplificado - certificado opcional
      memory: true, // Manter apenas verificação básica
      disk: false, // Simplificado - não verificar disco
    },

    // Thresholds otimizados
    thresholds: {
      memory: {
        warning: 0.95, // 95% - menos sensível
        critical: 0.98, // 98% - apenas crítico real
      },
      cpu: {
        warning: 0.85, // 85% - menos sensível
        critical: 0.95, // 95%
      },
      responseTime: {
        warning: 2000, // 2 segundos - menos sensível
        critical: 5000, // 5 segundos
      },
    },
  },

  // ==================== CONFIGURAÇÕES DE APM (SIMPLIFICADO) ====================
  apm: {
    enabled: process.env.APM_ENABLED === "true", // Desabilitado por padrão

    // Monitoramento básico apenas
    memory: {
      enabled: true,
      interval: parseInt(process.env.MEMORY_CHECK_INTERVAL) || 60000, // 1 minuto - menos frequente
      threshold: parseInt(process.env.MEMORY_THRESHOLD) || 800 * 1024 * 1024, // 800MB - menos sensível
    },

    // Monitoramento de Requests essencial
    requests: {
      slowThreshold: parseInt(process.env.REQUEST_SLOW_THRESHOLD) || 3000, // 3 segundos - menos sensível
    },
  },

  // ==================== CONFIGURAÇÕES DE ALERTAS ====================
  alerts: {
    enabled: process.env.ALERTS_ENABLED !== "false",

    // Canais de notificação
    channels: {
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED === "true",
        recipients: (process.env.ALERT_EMAIL_RECIPIENTS || "")
          .split(",")
          .filter(Boolean),
        smtp: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
      },
      webhook: {
        enabled: process.env.ALERT_WEBHOOK_ENABLED === "true",
        url: process.env.ALERT_WEBHOOK_URL,
        timeout: parseInt(process.env.ALERT_WEBHOOK_TIMEOUT) || 5000,
      },
    },

    // Configurações de throttling
    throttling: {
      enabled: true,
      window: parseInt(process.env.ALERT_THROTTLE_WINDOW) || 300000, // 5 minutos
      maxAlerts: parseInt(process.env.ALERT_THROTTLE_MAX) || 5,
    },
  },

  // ==================== CONFIGURAÇÕES ESPECÍFICAS NFE ====================
  nfe: {
    // Monitoramento de certificados
    certificate: {
      checkInterval: parseInt(process.env.CERT_CHECK_INTERVAL) || 86400000, // 24 horas
      warningDays: parseInt(process.env.CERT_WARNING_DAYS) || 30,
      criticalDays: parseInt(process.env.CERT_CRITICAL_DAYS) || 7,
    },

    // Monitoramento SEFAZ
    sefaz: {
      timeout: parseInt(process.env.SEFAZ_TIMEOUT) || 30000,
      retries: parseInt(process.env.SEFAZ_RETRIES) || 3,
      healthCheckInterval:
        parseInt(process.env.SEFAZ_HEALTH_INTERVAL) || 300000, // 5 minutos
    },

    // Métricas de negócio
    business: {
      trackNfeEmissions: true,
      trackNfeErrors: true,
      trackResponseTimes: true,
      trackCertificateStatus: true,
    },
  },
};

// ==================== VALIDAÇÃO DE CONFIGURAÇÃO ====================
function validateConfig() {
  const errors = [];

  // Validar configurações obrigatórias
  if (monitoringConfig.alerts.channels.email.enabled) {
    if (!monitoringConfig.alerts.channels.email.recipients.length) {
      errors.push(
        "ALERT_EMAIL_RECIPIENTS é obrigatório quando email está habilitado",
      );
    }
    if (!monitoringConfig.alerts.channels.email.smtp.host) {
      errors.push("SMTP_HOST é obrigatório quando email está habilitado");
    }
  }

  if (monitoringConfig.alerts.channels.webhook.enabled) {
    if (!monitoringConfig.alerts.channels.webhook.url) {
      errors.push(
        "ALERT_WEBHOOK_URL é obrigatório quando webhook está habilitado",
      );
    }
  }

  if (errors.length > 0) {
    console.warn("⚠️  Avisos de configuração de monitoramento:", errors);
  }

  return errors.length === 0;
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
  ...monitoringConfig,
  validate: validateConfig,
};
