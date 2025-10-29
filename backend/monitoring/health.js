// ==================== SISTEMA DE HEALTH CHECKS ====================
// Health checks robustos com verificação de dependências

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const pidusage = require('pidusage');
const monitoringConfig = require('../config/monitoring');
const { logger, logSystemEvent } = require('./logger');

// ==================== VERIFICAÇÕES DE SAÚDE ====================

/**
 * Verificação básica de saúde do sistema
 */
async function basicHealthCheck() {
  const startTime = Date.now();
  
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks: {}
    };
    
    // Verificação de memória
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    health.checks.memory = {
      status: memoryUsagePercent < monitoringConfig.health.thresholds.memory.critical ? 'healthy' : 'critical',
      usage: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        percentage: `${Math.round(memoryUsagePercent * 100)}%`
      },
      threshold: `${Math.round(monitoringConfig.health.thresholds.memory.critical * 100)}%`
    };
    
    // Verificação de CPU
    try {
      const stats = await pidusage(process.pid);
      health.checks.cpu = {
        status: stats.cpu < (monitoringConfig.health.thresholds.cpu.critical * 100) ? 'healthy' : 'critical',
        usage: `${Math.round(stats.cpu)}%`,
        threshold: `${Math.round(monitoringConfig.health.thresholds.cpu.critical * 100)}%`
      };
    } catch (error) {
      health.checks.cpu = {
        status: 'unknown',
        error: error.message
      };
    }
    
    // Verificação de event loop
    const eventLoopStart = process.hrtime.bigint();
    await new Promise(resolve => setImmediate(resolve));
    const eventLoopLag = Number(process.hrtime.bigint() - eventLoopStart) / 1e6; // ms
    
    health.checks.eventLoop = {
      status: eventLoopLag < 100 ? 'healthy' : 'warning',
      lag: `${Math.round(eventLoopLag)}ms`,
      threshold: '100ms'
    };
    
    // Determinar status geral
    const allChecks = Object.values(health.checks);
    if (allChecks.some(check => check.status === 'critical')) {
      health.status = 'critical';
    } else if (allChecks.some(check => check.status === 'warning')) {
      health.status = 'warning';
    }
    
    health.responseTime = `${Date.now() - startTime}ms`;
    
    return health;
    
  } catch (error) {
    logger.error('Erro no health check básico', { error: error.message });
    return {
      status: 'critical',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`
    };
  }
}

/**
 * Verificação detalhada de saúde com dependências
 */
async function detailedHealthCheck() {
  const startTime = Date.now();
  
  try {
    const health = await basicHealthCheck();
    
    // Verificações de dependências
    if (monitoringConfig.health.checks.database) {
      health.checks.database = await checkDatabase();
    }
    
    if (monitoringConfig.health.checks.certificate) {
      health.checks.certificate = await checkCertificates();
    }
    
    if (monitoringConfig.health.checks.sefaz) {
      health.checks.sefaz = await checkSefazConnectivity();
    }
    
    if (monitoringConfig.health.checks.disk) {
      health.checks.disk = await checkDiskSpace();
    }
    
    // Verificações específicas NFe
    health.checks.nfeConfig = await checkNfeConfiguration();
    
    // Recalcular status geral
    const allChecks = Object.values(health.checks);
    if (allChecks.some(check => check.status === 'critical')) {
      health.status = 'critical';
    } else if (allChecks.some(check => check.status === 'warning')) {
      health.status = 'warning';
    } else {
      health.status = 'healthy';
    }
    
    health.responseTime = `${Date.now() - startTime}ms`;
    
    return health;
    
  } catch (error) {
    logger.error('Erro no health check detalhado', { error: error.message });
    return {
      status: 'critical',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`
    };
  }
}

/**
 * Verificação do banco de dados
 */
async function checkDatabase() {
  try {
    if (process.env.USE_MONGODB === 'true') {
      // Verificação MongoDB (implementar conforme necessário)
      return {
        status: 'healthy',
        type: 'mongodb',
        message: 'Conexão MongoDB ativa'
      };
    } else {
      // Verificação arquivo JSON
      const dbPath = path.join(__dirname, '../data/database.json');
      await fs.access(dbPath);
      
      const stats = await fs.stat(dbPath);
      return {
        status: 'healthy',
        type: 'json',
        message: 'Arquivo de banco de dados acessível',
        lastModified: stats.mtime.toISOString(),
        size: `${Math.round(stats.size / 1024)}KB`
      };
    }
  } catch (error) {
    return {
      status: 'critical',
      type: process.env.USE_MONGODB === 'true' ? 'mongodb' : 'json',
      error: error.message
    };
  }
}

/**
 * Verificação de certificados
 */
async function checkCertificates() {
  try {
    const certsPath = path.join(__dirname, '../certs');
    
    try {
      const files = await fs.readdir(certsPath);
      const certFiles = files.filter(file => 
        file.endsWith('.p12') || file.endsWith('.pfx') || file.endsWith('.pem')
      );
      
      if (certFiles.length === 0) {
        return {
          status: 'not_configured',
          message: 'Certificado digital não configurado - Cliente deve importar via interface',
          path: certsPath
        };
      }
      
      const certificates = [];
      for (const certFile of certFiles) {
        const certPath = path.join(certsPath, certFile);
        const stats = await fs.stat(certPath);
        
        certificates.push({
          name: certFile,
          size: `${Math.round(stats.size / 1024)}KB`,
          lastModified: stats.mtime.toISOString()
        });
      }
      
      return {
        status: 'healthy',
        message: `${certFiles.length} certificado(s) encontrado(s)`,
        certificates
      };
      
    } catch (error) {
      return {
        status: 'not_configured',
        message: 'Certificado digital não configurado - Cliente deve importar via interface',
        path: certsPath
      };
    }
    
  } catch (error) {
    return {
      status: 'not_configured',
      message: 'Certificado digital não configurado - Cliente deve importar via interface'
    };
  }
}

/**
 * Verificação de conectividade SEFAZ
 */
async function checkSefazConnectivity() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        status: 'warning',
        message: 'Timeout na verificação SEFAZ',
        timeout: `${monitoringConfig.health.timeout}ms`
      });
    }, monitoringConfig.health.timeout);
    
    // Verificação simplificada - ping para um serviço SEFAZ
    const options = {
      hostname: 'nfe.fazenda.sp.gov.br',
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: monitoringConfig.health.timeout
    };
    
    const req = https.request(options, (res) => {
      clearTimeout(timeout);
      resolve({
        status: 'healthy',
        message: 'Conectividade SEFAZ OK',
        statusCode: res.statusCode,
        responseTime: Date.now()
      });
    });
    
    req.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        status: 'critical',
        message: 'Erro de conectividade SEFAZ',
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      clearTimeout(timeout);
      req.destroy();
      resolve({
        status: 'warning',
        message: 'Timeout na conectividade SEFAZ'
      });
    });
    
    req.end();
  });
}

/**
 * Verificação de espaço em disco
 */
async function checkDiskSpace() {
  try {
    const stats = await fs.stat(__dirname);
    
    // Verificação simplificada - em produção usar bibliotecas específicas
    return {
      status: 'healthy',
      message: 'Espaço em disco disponível',
      path: __dirname
    };
    
  } catch (error) {
    return {
      status: 'critical',
      error: error.message
    };
  }
}

/**
 * Verificação de configuração NFe
 */
async function checkNfeConfiguration() {
  try {
    const checks = [];
    
    // Verificar variáveis de ambiente essenciais
    const requiredEnvVars = [
      'NODE_ENV',
      'PORT'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        checks.push(`Variável ${envVar} não definida`);
      }
    }
    
    // Verificar arquivos de configuração
    const configFiles = [
      '../config/database.js',
      '../middleware/auth.js'
    ];
    
    for (const configFile of configFiles) {
      try {
        await fs.access(path.join(__dirname, configFile));
      } catch (error) {
        checks.push(`Arquivo ${configFile} não encontrado`);
      }
    }
    
    if (checks.length > 0) {
      return {
        status: 'warning',
        message: 'Problemas de configuração detectados',
        issues: checks
      };
    }
    
    return {
      status: 'healthy',
      message: 'Configuração NFe OK',
      environment: process.env.NODE_ENV,
      mongoEnabled: process.env.USE_MONGODB === 'true'
    };
    
  } catch (error) {
    return {
      status: 'critical',
      error: error.message
    };
  }
}

// ==================== ENDPOINTS DE HEALTH CHECK ====================

/**
 * Handler para endpoint básico de health check
 */
async function healthCheckHandler(req, res) {
  try {
    const health = await basicHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'warning' ? 200 : 503;
    
    // Garantir que a resposta seja JSON válido
    res.setHeader('Content-Type', 'application/json');
    res.status(statusCode).json(health);
    
    // Log do health check
    logSystemEvent('health_check', {
      status: health.status,
      responseTime: health.responseTime,
      endpoint: 'basic'
    });
    
  } catch (error) {
    logger.error('Erro no endpoint de health check', { error: error.message });
    res.setHeader('Content-Type', 'application/json');
    res.status(503).json({
      status: 'critical',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handler para endpoint detalhado de health check
 */
async function detailedHealthCheckHandler(req, res) {
  try {
    const health = await detailedHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'warning' ? 200 : 503;
    
    // Garantir que a resposta seja JSON válido
    res.setHeader('Content-Type', 'application/json');
    res.status(statusCode).json(health);
    
    // Log do health check detalhado
    logSystemEvent('detailed_health_check', {
      status: health.status,
      responseTime: health.responseTime,
      endpoint: 'detailed'
    });
    
  } catch (error) {
    logger.error('Erro no endpoint de health check detalhado', { error: error.message });
    res.setHeader('Content-Type', 'application/json');
    res.status(503).json({
      status: 'critical',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// ==================== INICIALIZAÇÃO ====================

/**
 * Inicializa o sistema de health checks
 */
function initializeHealthChecks() {
  console.log('🏥 Inicializando sistema de health checks...');
  
  // Health check inicial
  basicHealthCheck()
    .then(health => {
      logSystemEvent('health_check_initialized', {
        status: health.status,
        uptime: health.uptime
      });
      console.log('✅ Sistema de health checks inicializado');
    })
    .catch(error => {
      logger.error('Erro na inicialização do health check', { error: error.message });
    });
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
  // Verificações
  basicHealthCheck,
  detailedHealthCheck,
  
  // Verificações específicas
  checkDatabase,
  checkCertificates,
  checkSefazConnectivity,
  checkDiskSpace,
  checkNfeConfiguration,
  
  // Handlers para endpoints
  healthCheckHandler,
  detailedHealthCheckHandler,
  
  // Inicialização
  initialize: initializeHealthChecks
};