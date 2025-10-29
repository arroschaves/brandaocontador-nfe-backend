// ==================== CONFIGURAÇÃO DE MONITORAMENTO ====================
// Sistema completo de monitoramento, métricas e performance para NFe

const path = require('path');

const monitoringConfig = {
  // ==================== CONFIGURAÇÕES GERAIS ====================
  enabled: process.env.MONITORING_ENABLED !== 'false',
  environment: process.env.NODE_ENV || 'development',
  
  // ==================== CONFIGURAÇÕES DE LOGS ====================
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json', // json, simple
    directory: path.join(__dirname, '../logs'),
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    
    // Configurações específicas por tipo
    files: {
      combined: 'combined-%DATE%.log',
      error: 'error-%DATE%.log',
      security: 'security-%DATE%.log',
      performance: 'performance-%DATE%.log',
      nfe: 'nfe-%DATE%.log'
    }
  },

  // ==================== CONFIGURAÇÕES DE MÉTRICAS ====================
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    endpoint: '/metrics',
    collectDefaultMetrics: true,
    prefix: 'nfe_backend_',
    
    // Configurações de coleta
    collection: {
      interval: parseInt(process.env.METRICS_INTERVAL) || 5000, // 5 segundos
      timeout: parseInt(process.env.METRICS_TIMEOUT) || 10000   // 10 segundos
    },

    // Métricas customizadas para NFe
    custom: {
      nfe_requests_total: 'Contador total de requisições NFe',
      nfe_requests_duration: 'Duração das requisições NFe',
      nfe_errors_total: 'Contador total de erros NFe',
      sefaz_response_time: 'Tempo de resposta do SEFAZ',
      certificate_expiry_days: 'Dias até expiração do certificado',
      database_connections: 'Conexões ativas do banco de dados',
      memory_usage_bytes: 'Uso de memória em bytes',
      cpu_usage_percent: 'Uso de CPU em porcentagem'
    }
  },

  // ==================== CONFIGURAÇÕES DE HEALTH CHECK ====================
  health: {
    endpoint: '/health',
    detailed: '/health/detailed',
    timeout: parseInt(process.env.HEALTH_TIMEOUT) || 5000,
    
    // Verificações de dependências
    checks: {
      database: true,
      sefaz: true,
      certificate: true,
      memory: true,
      disk: true
    },

    // Thresholds para alertas
    thresholds: {
      memory: {
        warning: 0.8,  // 80%
        critical: 0.95  // 95%
      },
      cpu: {
        warning: 0.7,  // 70%
        critical: 0.95  // 95%
      },
      disk: {
        warning: 0.8,  // 80%
        critical: 0.95 // 95%
      },
      responseTime: {
        warning: 1000,  // 1 segundo
        critical: 5000  // 5 segundos
      }
    }
  },

  // ==================== CONFIGURAÇÕES DE APM ====================
  apm: {
    enabled: process.env.APM_ENABLED !== 'false',
    
    // Monitoramento de Event Loop
    eventLoop: {
      enabled: true,
      interval: parseInt(process.env.EVENT_LOOP_INTERVAL) || 1000, // 1 segundo
      warningThreshold: parseInt(process.env.EVENT_LOOP_THRESHOLD) || 100 // ms
    },

    // Monitoramento de Memória
    memory: {
      enabled: true,
      interval: parseInt(process.env.MEMORY_CHECK_INTERVAL) || 30000, // 30 segundos
      threshold: parseInt(process.env.MEMORY_THRESHOLD) || 500 * 1024 * 1024, // 500MB
      checkInterval: parseInt(process.env.MEMORY_LEAK_CHECK_INTERVAL) || 60000, // 1 minuto
      leakThreshold: parseInt(process.env.MEMORY_LEAK_THRESHOLD) || 1000 // 1GB
    },

    // Monitoramento de CPU
    cpu: {
      enabled: true,
      interval: parseInt(process.env.CPU_CHECK_INTERVAL) || 10000, // 10 segundos
      threshold: parseFloat(process.env.CPU_THRESHOLD) || 80 // 80%
    },

    // Garbage Collection
    gc: {
      enabled: true,
      warningThreshold: parseInt(process.env.GC_THRESHOLD) || 100 // ms
    },

    // Monitoramento de Requests
    requests: {
      slowThreshold: parseInt(process.env.REQUEST_SLOW_THRESHOLD) || 1000 // 1 segundo
    },

    // Monitoramento geral do sistema
    system: {
      interval: parseInt(process.env.SYSTEM_MONITOR_INTERVAL) || 30000 // 30 segundos
    }
  },

  // ==================== CONFIGURAÇÕES DE ALERTAS ====================
  alerts: {
    enabled: process.env.ALERTS_ENABLED !== 'false',
    
    // Canais de notificação
    channels: {
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
        recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
        smtp: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        }
      },
      webhook: {
        enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
        url: process.env.ALERT_WEBHOOK_URL,
        timeout: parseInt(process.env.ALERT_WEBHOOK_TIMEOUT) || 5000
      }
    },

    // Configurações de throttling
    throttling: {
      enabled: true,
      window: parseInt(process.env.ALERT_THROTTLE_WINDOW) || 300000, // 5 minutos
      maxAlerts: parseInt(process.env.ALERT_THROTTLE_MAX) || 5
    }
  },

  // ==================== CONFIGURAÇÕES ESPECÍFICAS NFE ====================
  nfe: {
    // Monitoramento de certificados
    certificate: {
      checkInterval: parseInt(process.env.CERT_CHECK_INTERVAL) || 86400000, // 24 horas
      warningDays: parseInt(process.env.CERT_WARNING_DAYS) || 30,
      criticalDays: parseInt(process.env.CERT_CRITICAL_DAYS) || 7
    },

    // Monitoramento SEFAZ
    sefaz: {
      timeout: parseInt(process.env.SEFAZ_TIMEOUT) || 30000,
      retries: parseInt(process.env.SEFAZ_RETRIES) || 3,
      healthCheckInterval: parseInt(process.env.SEFAZ_HEALTH_INTERVAL) || 300000 // 5 minutos
    },

    // Métricas de negócio
    business: {
      trackNfeEmissions: true,
      trackNfeErrors: true,
      trackResponseTimes: true,
      trackCertificateStatus: true
    }
  }
};

// ==================== VALIDAÇÃO DE CONFIGURAÇÃO ====================
function validateConfig() {
  const errors = [];

  // Validar configurações obrigatórias
  if (monitoringConfig.alerts.channels.email.enabled) {
    if (!monitoringConfig.alerts.channels.email.recipients.length) {
      errors.push('ALERT_EMAIL_RECIPIENTS é obrigatório quando email está habilitado');
    }
    if (!monitoringConfig.alerts.channels.email.smtp.host) {
      errors.push('SMTP_HOST é obrigatório quando email está habilitado');
    }
  }

  if (monitoringConfig.alerts.channels.webhook.enabled) {
    if (!monitoringConfig.alerts.channels.webhook.url) {
      errors.push('ALERT_WEBHOOK_URL é obrigatório quando webhook está habilitado');
    }
  }

  if (errors.length > 0) {
    console.warn('⚠️  Avisos de configuração de monitoramento:', errors);
  }

  return errors.length === 0;
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
  ...monitoringConfig,
  validate: validateConfig
};