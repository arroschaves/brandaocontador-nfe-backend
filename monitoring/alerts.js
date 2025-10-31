// ==================== SISTEMA DE ALERTAS E NOTIFICAÇÕES ====================
// Sistema de alertas configurável com notificações por email/webhook

const https = require('https');
const http = require('http');
const url = require('url');
const monitoringConfig = require('../config/monitoring');
const { logger, logSystemEvent } = require('./logger');

// ==================== VARIÁVEIS GLOBAIS ====================
let alertHistory = [];
let alertThrottling = new Map();
let alertRules = [];

// ==================== TIPOS DE ALERTA ====================
const ALERT_TYPES = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

const ALERT_CATEGORIES = {
  SYSTEM: 'system',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  NFE: 'nfe',
  DATABASE: 'database',
  NETWORK: 'network'
};

// ==================== CONFIGURAÇÃO DE REGRAS DE ALERTA ====================

/**
 * Inicializa as regras de alerta padrão
 */
function initializeAlertRules() {
  alertRules = [
    // Alertas de Sistema
    {
      id: 'high_cpu_usage',
      category: ALERT_CATEGORIES.SYSTEM,
      type: ALERT_TYPES.WARNING,
      condition: (metrics) => metrics.cpu > 80,
      message: (metrics) => `Alto uso de CPU: ${Math.round(metrics.cpu)}%`,
      throttle: 300000 // 5 minutos
    },
    {
      id: 'critical_cpu_usage',
      category: ALERT_CATEGORIES.SYSTEM,
      type: ALERT_TYPES.CRITICAL,
      condition: (metrics) => metrics.cpu > 95,
      message: (metrics) => `Uso crítico de CPU: ${Math.round(metrics.cpu)}%`,
      throttle: 60000 // 1 minuto
    },
    {
      id: 'high_memory_usage',
      category: ALERT_CATEGORIES.SYSTEM,
      type: ALERT_TYPES.WARNING,
      condition: (metrics) => metrics.memoryUsagePercent > 0.85,
      message: (metrics) => `Alto uso de memória: ${Math.round(metrics.memoryUsagePercent * 100)}%`,
      throttle: 300000
    },
    {
      id: 'critical_memory_usage',
      category: ALERT_CATEGORIES.SYSTEM,
      type: ALERT_TYPES.CRITICAL,
      condition: (metrics) => metrics.memoryUsagePercent > 0.95,
      message: (metrics) => `Uso crítico de memória: ${Math.round(metrics.memoryUsagePercent * 100)}%`,
      throttle: 60000
    },
    
    // Alertas de Performance
    {
      id: 'high_event_loop_lag',
      category: ALERT_CATEGORIES.PERFORMANCE,
      type: ALERT_TYPES.WARNING,
      condition: (metrics) => metrics.eventLoopLag > 100,
      message: (metrics) => `Alto lag do event loop: ${Math.round(metrics.eventLoopLag)}ms`,
      throttle: 180000 // 3 minutos
    },
    {
      id: 'slow_response_time',
      category: ALERT_CATEGORIES.PERFORMANCE,
      type: ALERT_TYPES.WARNING,
      condition: (metrics) => metrics.avgResponseTime > 5000,
      message: (metrics) => `Tempo de resposta lento: ${Math.round(metrics.avgResponseTime)}ms`,
      throttle: 300000
    },
    
    // Alertas de NFe
    {
      id: 'high_nfe_error_rate',
      category: ALERT_CATEGORIES.NFE,
      type: ALERT_TYPES.WARNING,
      condition: (metrics) => metrics.nfeErrorRate > 0.1, // 10%
      message: (metrics) => `Alta taxa de erro NFe: ${Math.round(metrics.nfeErrorRate * 100)}%`,
      throttle: 600000 // 10 minutos
    },
    {
      id: 'sefaz_connectivity_issue',
      category: ALERT_CATEGORIES.NETWORK,
      type: ALERT_TYPES.CRITICAL,
      condition: (metrics) => metrics.sefazConnectivity === false,
      message: () => 'Problema de conectividade com SEFAZ',
      throttle: 300000
    },
    
    // Alertas de Segurança
    {
      id: 'high_error_rate',
      category: ALERT_CATEGORIES.SECURITY,
      type: ALERT_TYPES.WARNING,
      condition: (metrics) => metrics.errorRate > 0.05, // 5%
      message: (metrics) => `Alta taxa de erro: ${Math.round(metrics.errorRate * 100)}%`,
      throttle: 300000
    }
  ];
  
  console.log(`📋 ${alertRules.length} regras de alerta inicializadas`);
}

// ==================== PROCESSAMENTO DE ALERTAS ====================

/**
 * Processa métricas e verifica alertas
 */
function processAlerts(metrics) {
  const triggeredAlerts = [];
  
  for (const rule of alertRules) {
    try {
      if (rule.condition(metrics)) {
        const alertId = `${rule.id}_${Date.now()}`;
        
        // Verificar throttling
        if (isThrottled(rule.id, rule.throttle)) {
          continue;
        }
        
        const alert = {
          id: alertId,
          ruleId: rule.id,
          category: rule.category,
          type: rule.type,
          message: rule.message(metrics),
          timestamp: new Date().toISOString(),
          metrics: { ...metrics }
        };
        
        triggeredAlerts.push(alert);
        alertHistory.push(alert);
        
        // Manter histórico limitado
        if (alertHistory.length > 1000) {
          alertHistory = alertHistory.slice(-500);
        }
        
        // Registrar throttling
        alertThrottling.set(rule.id, Date.now());
        
        // Enviar notificação
        sendNotification(alert);
        
        // Log do alerta
        logSystemEvent('alert_triggered', {
          alertId,
          ruleId: rule.id,
          category: rule.category,
          type: rule.type,
          message: alert.message
        });
        
      }
    } catch (error) {
      logger.error(`Erro ao processar regra de alerta ${rule.id}`, { error: error.message });
    }
  }
  
  return triggeredAlerts;
}

/**
 * Verifica se um alerta está em throttling
 */
function isThrottled(ruleId, throttleTime) {
  const lastTriggered = alertThrottling.get(ruleId);
  if (!lastTriggered) return false;
  
  return (Date.now() - lastTriggered) < throttleTime;
}

// ==================== NOTIFICAÇÕES ====================

/**
 * Envia notificação de alerta
 */
async function sendNotification(alert) {
  const notifications = [];
  
  // Notificação por email
  if (monitoringConfig.alerts.channels.email.enabled) {
    notifications.push(sendEmailNotification(alert));
  }
  
  // Notificação por webhook
  if (monitoringConfig.alerts.channels.webhook.enabled) {
    notifications.push(sendWebhookNotification(alert));
  }
  
  // Aguardar todas as notificações
  try {
    await Promise.allSettled(notifications);
  } catch (error) {
    logger.error('Erro ao enviar notificações', { 
      alertId: alert.id,
      error: error.message 
    });
  }
}

/**
 * Envia notificação por email (simulado)
 */
async function sendEmailNotification(alert) {
  return new Promise((resolve, reject) => {
    try {
      // Simular envio de email
      // Em produção, usar serviços como SendGrid, AWS SES, etc.
      
      const emailData = {
        to: monitoringConfig.alerts.email.recipients,
        subject: `[${alert.type.toUpperCase()}] Sistema NFe - ${alert.category}`,
        body: formatEmailBody(alert)
      };
      
      // Log da tentativa de envio
      logSystemEvent('email_notification_sent', {
        alertId: alert.id,
        recipients: emailData.to,
        subject: emailData.subject
      });
      
      console.log(`📧 Email de alerta enviado: ${alert.message}`);
      resolve(emailData);
      
    } catch (error) {
      logger.error('Erro ao enviar email de alerta', { 
        alertId: alert.id,
        error: error.message 
      });
      reject(error);
    }
  });
}

/**
 * Envia notificação por webhook
 */
async function sendWebhookNotification(alert) {
  return new Promise((resolve, reject) => {
    try {
      const webhookUrl = monitoringConfig.alerts.webhook.url;
      if (!webhookUrl) {
        resolve(null);
        return;
      }
      
      const payload = JSON.stringify({
        alert: {
          id: alert.id,
          type: alert.type,
          category: alert.category,
          message: alert.message,
          timestamp: alert.timestamp
        },
        system: {
          environment: process.env.NODE_ENV,
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0'
        }
      });
      
      const parsedUrl = url.parse(webhookUrl);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'NFe-Backend-Monitor/1.0'
        }
      };
      
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logSystemEvent('webhook_notification_sent', {
              alertId: alert.id,
              url: webhookUrl,
              statusCode: res.statusCode
            });
            resolve({ statusCode: res.statusCode, data });
          } else {
            reject(new Error(`Webhook failed with status ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        logger.error('Erro ao enviar webhook de alerta', { 
          alertId: alert.id,
          url: webhookUrl,
          error: error.message 
        });
        reject(error);
      });
      
      req.setTimeout(monitoringConfig.alerts.webhook.timeout, () => {
        req.destroy();
        reject(new Error('Webhook timeout'));
      });
      
      req.write(payload);
      req.end();
      
    } catch (error) {
      logger.error('Erro ao preparar webhook de alerta', { 
        alertId: alert.id,
        error: error.message 
      });
      reject(error);
    }
  });
}

/**
 * Formata o corpo do email de alerta
 */
function formatEmailBody(alert) {
  return `
ALERTA DO SISTEMA NFE
=====================

Tipo: ${alert.type.toUpperCase()}
Categoria: ${alert.category}
Mensagem: ${alert.message}
Timestamp: ${alert.timestamp}

Métricas do Sistema:
- CPU: ${Math.round(alert.metrics.cpu || 0)}%
- Memória: ${Math.round((alert.metrics.memoryUsagePercent || 0) * 100)}%
- Event Loop Lag: ${Math.round(alert.metrics.eventLoopLag || 0)}ms
- Tempo Médio de Resposta: ${Math.round(alert.metrics.avgResponseTime || 0)}ms

Ambiente: ${process.env.NODE_ENV || 'development'}
Uptime: ${Math.round(process.uptime())} segundos

---
Sistema de Monitoramento NFe
  `;
}

// ==================== GERENCIAMENTO DE ALERTAS ====================

/**
 * Adiciona uma nova regra de alerta
 */
function addAlertRule(rule) {
  if (!rule.id || !rule.condition || !rule.message) {
    throw new Error('Regra de alerta inválida: id, condition e message são obrigatórios');
  }
  
  // Verificar se já existe
  const existingIndex = alertRules.findIndex(r => r.id === rule.id);
  if (existingIndex >= 0) {
    alertRules[existingIndex] = { ...alertRules[existingIndex], ...rule };
  } else {
    alertRules.push({
      category: ALERT_CATEGORIES.SYSTEM,
      type: ALERT_TYPES.WARNING,
      throttle: 300000,
      ...rule
    });
  }
  
  logSystemEvent('alert_rule_added', { ruleId: rule.id });
}

/**
 * Remove uma regra de alerta
 */
function removeAlertRule(ruleId) {
  const index = alertRules.findIndex(r => r.id === ruleId);
  if (index >= 0) {
    alertRules.splice(index, 1);
    alertThrottling.delete(ruleId);
    logSystemEvent('alert_rule_removed', { ruleId });
    return true;
  }
  return false;
}

/**
 * Lista todas as regras de alerta
 */
function getAlertRules() {
  return alertRules.map(rule => ({
    id: rule.id,
    category: rule.category,
    type: rule.type,
    throttle: rule.throttle,
    description: rule.message.toString()
  }));
}

/**
 * Obtém histórico de alertas
 */
function getAlertHistory(limit = 50) {
  return alertHistory
    .slice(-limit)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Limpa histórico de alertas
 */
function clearAlertHistory() {
  alertHistory = [];
  logSystemEvent('alert_history_cleared');
}

// ==================== HANDLERS PARA ENDPOINTS ====================

/**
 * Handler para endpoint de alertas
 */
function alertsHandler(req, res) {
  try {
    const { limit } = req.query;
    const history = getAlertHistory(parseInt(limit) || 50);
    
    res.json({
      alerts: history,
      rules: getAlertRules(),
      stats: {
        totalAlerts: alertHistory.length,
        activeRules: alertRules.length,
        throttledRules: alertThrottling.size
      }
    });
    
  } catch (error) {
    logger.error('Erro no endpoint de alertas', { error: error.message });
    res.status(500).json({
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handler para testar alertas
 */
function testAlertHandler(req, res) {
  try {
    const testAlert = {
      id: `test_${Date.now()}`,
      ruleId: 'test_alert',
      category: ALERT_CATEGORIES.SYSTEM,
      type: ALERT_TYPES.INFO,
      message: 'Teste de alerta do sistema',
      timestamp: new Date().toISOString(),
      metrics: {
        cpu: 50,
        memoryUsagePercent: 0.6,
        eventLoopLag: 10,
        avgResponseTime: 100
      }
    };
    
    sendNotification(testAlert);
    
    res.json({
      message: 'Alerta de teste enviado',
      alert: testAlert
    });
    
  } catch (error) {
    logger.error('Erro ao enviar alerta de teste', { error: error.message });
    res.status(500).json({
      error: 'Erro ao enviar alerta de teste',
      timestamp: new Date().toISOString()
    });
  }
}

// ==================== INICIALIZAÇÃO ====================

/**
 * Inicializa o sistema de alertas
 */
function initializeAlerts() {
  console.log('🚨 Inicializando sistema de alertas...');
  
  try {
    initializeAlertRules();
    
    // Limpar throttling antigo periodicamente
    setInterval(() => {
      const now = Date.now();
      for (const [ruleId, timestamp] of alertThrottling.entries()) {
        if (now - timestamp > 3600000) { // 1 hora
          alertThrottling.delete(ruleId);
        }
      }
    }, 600000); // 10 minutos
    
    console.log('✅ Sistema de alertas inicializado');
    
    logSystemEvent('alerts_system_initialized', {
      rulesCount: alertRules.length,
      emailEnabled: monitoringConfig.alerts.channels.email.enabled,
      webhookEnabled: monitoringConfig.alerts.channels.webhook.enabled
    });
    
  } catch (error) {
    logger.error('Erro na inicialização do sistema de alertas', { error: error.message });
    console.error('❌ Erro na inicialização dos alertas:', error.message);
  }
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
  // Constantes
  ALERT_TYPES,
  ALERT_CATEGORIES,
  
  // Processamento
  processAlerts,
  sendNotification,
  
  // Gerenciamento de regras
  addAlertRule,
  removeAlertRule,
  getAlertRules,
  
  // Histórico
  getAlertHistory,
  clearAlertHistory,
  
  // Handlers
  alertsHandler,
  testAlertHandler,
  
  // Inicialização
  initialize: initializeAlerts
};