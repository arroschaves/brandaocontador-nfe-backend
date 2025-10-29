// ==================== APM (APPLICATION PERFORMANCE MONITORING) ====================
// Sistema de monitoramento de performance da aplicação

const pidusage = require('pidusage');
const monitoringConfig = require('../config/monitoring');
const { logger, logPerformanceMetric, logSystemEvent } = require('./logger');
const { collectSystemMetrics } = require('./metrics');

// ==================== VARIÁVEIS GLOBAIS ====================
let apmStats = {
  startTime: Date.now(),
  requests: {
    total: 0,
    active: 0,
    errors: 0,
    avgResponseTime: 0,
    responseTimeHistory: []
  },
  system: {
    cpu: 0,
    memory: 0,
    eventLoopLag: 0,
    gcStats: {
      collections: 0,
      duration: 0
    }
  },
  nfe: {
    processed: 0,
    errors: 0,
    avgProcessingTime: 0,
    sefazResponseTime: 0
  }
};

let performanceObserver = null;
let monitoringInterval = null;
let eventLoopMonitor = null;

// ==================== MONITORAMENTO DE EVENT LOOP ====================

/**
 * Monitora o lag do event loop
 */
function startEventLoopMonitoring() {
  let start = process.hrtime.bigint();
  
  function measureEventLoopLag() {
    const delta = process.hrtime.bigint() - start;
    const lag = Number(delta) / 1e6; // Convert to milliseconds
    
    apmStats.system.eventLoopLag = lag;
    
    // Log se o lag for muito alto
    if (lag > monitoringConfig.apm.eventLoop.warningThreshold) {
      logPerformanceMetric('event_loop_lag', Math.round(lag), 'ms', {
        threshold: `${monitoringConfig.apm.eventLoop.warningThreshold}ms`,
        status: 'high'
      });
    }
    
    start = process.hrtime.bigint();
  }
  
  eventLoopMonitor = setInterval(measureEventLoopLag, monitoringConfig.apm.eventLoop.interval);
}

/**
 * Para o monitoramento do event loop
 */
function stopEventLoopMonitoring() {
  if (eventLoopMonitor) {
    clearInterval(eventLoopMonitor);
    eventLoopMonitor = null;
  }
}

// ==================== MONITORAMENTO DE GARBAGE COLLECTION ====================

/**
 * Monitora o garbage collection
 */
function startGCMonitoring() {
  if (!monitoringConfig.apm.gc.enabled) return;
  
  try {
    // Usar PerformanceObserver para monitorar GC
    const { PerformanceObserver, performance } = require('perf_hooks');
    
    performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      entries.forEach((entry) => {
        if (entry.entryType === 'gc') {
          apmStats.system.gcStats.collections++;
          apmStats.system.gcStats.duration += entry.duration;
          
          // Log GC events que demoram muito
          if (entry.duration > monitoringConfig.apm.gc.warningThreshold) {
            logPerformanceMetric('gc_duration', Math.round(entry.duration), 'ms', {
              kind: entry.detail?.kind || 'unknown',
              threshold: `${monitoringConfig.apm.gc.warningThreshold}ms`,
              status: 'slow'
            });
          }
        }
      });
    });
    
    performanceObserver.observe({ entryTypes: ['gc'] });
    
  } catch (error) {
    logger.warn('GC monitoring não disponível', { error: error.message });
  }
}

/**
 * Para o monitoramento de GC
 */
function stopGCMonitoring() {
  if (performanceObserver) {
    performanceObserver.disconnect();
    performanceObserver = null;
  }
}

// ==================== MONITORAMENTO DE SISTEMA ====================

/**
 * Coleta métricas do sistema
 */
async function collectSystemStats() {
  try {
    // CPU e memória usando pidusage
    const stats = await pidusage(process.pid);
    apmStats.system.cpu = stats.cpu;
    apmStats.system.memory = stats.memory;
    
    // Memória do processo Node.js
    const memoryUsage = process.memoryUsage();
    
    // Memória do sistema (corrigido para usar valores reais do sistema)
    const os = require('os');
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = usedMemory / totalMemory;
    
    // Alertas de performance
    if (stats.cpu > monitoringConfig.apm.cpu.threshold) {
      logPerformanceMetric('cpu_usage', Math.round(stats.cpu), '%', {
        threshold: `${monitoringConfig.apm.cpu.threshold}%`,
        status: 'high'
      });
    }
    
    const memoryThresholdBytes = monitoringConfig.apm.memory.threshold;
    if (memoryUsage.heapUsed > memoryThresholdBytes) {
      logPerformanceMetric('memory_usage', Math.round(memoryUsage.heapUsed / 1024 / 1024), 'MB', {
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        threshold: `${Math.round(memoryThresholdBytes / 1024 / 1024)}MB`,
        status: 'high'
      });
    }
    
    return {
      cpu: stats.cpu,
      memory: {
        system: stats.memory,
        heap: memoryUsage,
        percentage: memoryUsagePercent
      },
      uptime: process.uptime()
    };
    
  } catch (error) {
    logger.error('Erro ao coletar estatísticas do sistema', { error: error.message });
    return null;
  }
}

/**
 * Inicia o monitoramento contínuo do sistema
 */
function startSystemMonitoring() {
  monitoringInterval = setInterval(async () => {
    await collectSystemStats();
    
    // Coleta métricas customizadas
    if (typeof collectSystemMetrics === 'function') {
      collectSystemMetrics();
    }
    
  }, monitoringConfig.apm.system.interval);
}

/**
 * Para o monitoramento do sistema
 */
function stopSystemMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

// ==================== MIDDLEWARE DE PERFORMANCE ====================

/**
 * Middleware para monitorar performance de requests
 */
function performanceMiddleware(req, res, next) {
  const startTime = Date.now();
  const startHrTime = process.hrtime.bigint();
  
  // Incrementar requests ativos
  apmStats.requests.active++;
  apmStats.requests.total++;
  
  // Adicionar trace ID se não existir
  if (!req.traceId) {
    req.traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Interceptar o final da response
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const hrResponseTime = Number(process.hrtime.bigint() - startHrTime) / 1e6;
    
    // Decrementar requests ativos
    apmStats.requests.active--;
    
    // Atualizar estatísticas
    apmStats.requests.responseTimeHistory.push(responseTime);
    if (apmStats.requests.responseTimeHistory.length > 100) {
      apmStats.requests.responseTimeHistory.shift();
    }
    
    // Calcular tempo médio de resposta
    const avgTime = apmStats.requests.responseTimeHistory.reduce((a, b) => a + b, 0) / 
                   apmStats.requests.responseTimeHistory.length;
    apmStats.requests.avgResponseTime = avgTime;
    
    // Contar erros
    if (res.statusCode >= 400) {
      apmStats.requests.errors++;
    }
    
    // Log de performance para requests lentos
    if (responseTime > monitoringConfig.apm.requests.slowThreshold) {
      logPerformanceMetric('request_response_time', responseTime, 'ms', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        traceId: req.traceId,
        threshold: `${monitoringConfig.apm.requests.slowThreshold}ms`,
        status: 'slow'
      });
    }
    
    // Adicionar headers de performance
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-Trace-ID', req.traceId);
    
    originalEnd.apply(res, args);
  };
  
  next();
}

// ==================== MONITORAMENTO ESPECÍFICO NFE ====================

/**
 * Registra processamento de NFe
 */
function recordNfeProcessing(processingTime, success = true, sefazResponseTime = null) {
  if (success) {
    apmStats.nfe.processed++;
  } else {
    apmStats.nfe.errors++;
  }
  
  // Atualizar tempo médio de processamento
  if (apmStats.nfe.processed > 0) {
    apmStats.nfe.avgProcessingTime = 
      (apmStats.nfe.avgProcessingTime * (apmStats.nfe.processed - 1) + processingTime) / 
      apmStats.nfe.processed;
  }
  
  // Atualizar tempo de resposta SEFAZ
  if (sefazResponseTime) {
    apmStats.nfe.sefazResponseTime = sefazResponseTime;
  }
  
  // Log de performance NFe
  logPerformanceMetric('nfe_processing_time', processingTime, 'ms', {
    success,
    sefazResponseTime: sefazResponseTime ? `${sefazResponseTime}ms` : null,
    totalProcessed: apmStats.nfe.processed,
    errorRate: `${Math.round((apmStats.nfe.errors / (apmStats.nfe.processed + apmStats.nfe.errors)) * 100)}%`
  });
}

/**
 * Detecta possíveis memory leaks
 */
function detectMemoryLeaks() {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  
  // Verificar se o uso de memória está crescendo constantemente
  if (heapUsedMB > monitoringConfig.apm.memory.leakThreshold) {
    logPerformanceMetric('memory_leak_detection', Math.round(heapUsedMB), 'MB', {
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      threshold: `${monitoringConfig.apm.memory.leakThreshold}MB`,
      status: 'potential_leak'
    });
  }
}

// ==================== RELATÓRIOS DE PERFORMANCE ====================

/**
 * Gera relatório de performance
 */
function generatePerformanceReport() {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  return {
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.round(uptime),
      formatted: formatUptime(uptime)
    },
    requests: {
      total: apmStats.requests.total,
      active: apmStats.requests.active,
      errors: apmStats.requests.errors,
      errorRate: apmStats.requests.total > 0 ? 
        `${Math.round((apmStats.requests.errors / apmStats.requests.total) * 100)}%` : '0%',
      avgResponseTime: `${Math.round(apmStats.requests.avgResponseTime)}ms`,
      requestsPerSecond: Math.round(apmStats.requests.total / uptime)
    },
    system: {
      cpu: `${Math.round(apmStats.system.cpu)}%`,
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      },
      eventLoopLag: `${Math.round(apmStats.system.eventLoopLag)}ms`,
      gc: {
        collections: apmStats.system.gcStats.collections,
        totalDuration: `${Math.round(apmStats.system.gcStats.duration)}ms`,
        avgDuration: apmStats.system.gcStats.collections > 0 ? 
          `${Math.round(apmStats.system.gcStats.duration / apmStats.system.gcStats.collections)}ms` : '0ms'
      }
    },
    nfe: {
      processed: apmStats.nfe.processed,
      errors: apmStats.nfe.errors,
      errorRate: (apmStats.nfe.processed + apmStats.nfe.errors) > 0 ? 
        `${Math.round((apmStats.nfe.errors / (apmStats.nfe.processed + apmStats.nfe.errors)) * 100)}%` : '0%',
      avgProcessingTime: `${Math.round(apmStats.nfe.avgProcessingTime)}ms`,
      lastSefazResponseTime: `${Math.round(apmStats.nfe.sefazResponseTime)}ms`
    }
  };
}

/**
 * Formata tempo de uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// ==================== HANDLERS PARA ENDPOINTS ====================

/**
 * Handler para endpoint de status de performance
 */
function performanceStatusHandler(req, res) {
  try {
    const report = generatePerformanceReport();
    res.json(report);
    
  } catch (error) {
    logger.error('Erro ao gerar relatório de performance', { error: error.message });
    res.status(500).json({
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    });
  }
}

// ==================== INICIALIZAÇÃO ====================

/**
 * Inicializa o sistema APM
 */
function initializeAPM() {
  console.log('📊 Inicializando APM (Application Performance Monitoring)...');
  
  try {
    // Iniciar monitoramentos
    startEventLoopMonitoring();
    startGCMonitoring();
    startSystemMonitoring();
    
    // Detectar memory leaks periodicamente
    setInterval(detectMemoryLeaks, monitoringConfig.apm.memory.checkInterval);
    
    console.log('✅ APM inicializado com sucesso');
    
    logSystemEvent('apm_initialized', {
      eventLoopMonitoring: true,
      gcMonitoring: monitoringConfig.apm.gc.enabled,
      systemMonitoring: true,
      memoryLeakDetection: true
    });
    
  } catch (error) {
    logger.error('Erro na inicialização do APM', { error: error.message });
    console.error('❌ Erro na inicialização do APM:', error.message);
  }
}

/**
 * Para todos os monitoramentos APM
 */
function stopAPM() {
  console.log('🛑 Parando APM...');
  
  stopEventLoopMonitoring();
  stopGCMonitoring();
  stopSystemMonitoring();
  
  console.log('✅ APM parado');
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
  // Middleware
  performanceMiddleware,
  
  // Monitoramento específico
  recordNfeProcessing,
  detectMemoryLeaks,
  
  // Relatórios
  generatePerformanceReport,
  performanceStatusHandler,
  
  // Controle
  initialize: initializeAPM,
  stop: stopAPM,
  
  // Estatísticas
  getStats: () => ({ ...apmStats }),
  
  // Monitoramento manual
  collectSystemStats
};