// ==================== SISTEMA DE MÉTRICAS PROMETHEUS ====================
// Métricas customizadas para monitoramento do backend NFe

const promClient = require("prom-client");
const pidusage = require("pidusage");
const fs = require("fs").promises;
const path = require("path");
const monitoringConfig = require("../config/monitoring");

// ==================== CONFIGURAÇÃO INICIAL ====================
const register = new promClient.Registry();

// Coletar métricas padrão do Node.js
if (monitoringConfig.metrics.collectDefaultMetrics) {
  promClient.collectDefaultMetrics({
    register,
    prefix: monitoringConfig.metrics.prefix,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });
}

// ==================== MÉTRICAS CUSTOMIZADAS ====================

// Contador de requisições NFe
const nfeRequestsTotal = new promClient.Counter({
  name: `${monitoringConfig.metrics.prefix}nfe_requests_total`,
  help: "Contador total de requisições NFe",
  labelNames: ["method", "endpoint", "status_code", "operation"],
  registers: [register],
});

// Histograma de duração das requisições NFe
const nfeRequestsDuration = new promClient.Histogram({
  name: `${monitoringConfig.metrics.prefix}nfe_requests_duration_seconds`,
  help: "Duração das requisições NFe em segundos",
  labelNames: ["method", "endpoint", "operation"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Contador de erros NFe
const nfeErrorsTotal = new promClient.Counter({
  name: `${monitoringConfig.metrics.prefix}nfe_errors_total`,
  help: "Contador total de erros NFe",
  labelNames: ["type", "operation", "error_code"],
  registers: [register],
});

// Gauge para tempo de resposta SEFAZ
const sefazResponseTime = new promClient.Gauge({
  name: `${monitoringConfig.metrics.prefix}sefaz_response_time_seconds`,
  help: "Tempo de resposta do SEFAZ em segundos",
  labelNames: ["uf", "service"],
  registers: [register],
});

// Gauge para dias até expiração do certificado
const certificateExpiryDays = new promClient.Gauge({
  name: `${monitoringConfig.metrics.prefix}certificate_expiry_days`,
  help: "Dias até expiração do certificado",
  labelNames: ["certificate_type", "subject"],
  registers: [register],
});

// Gauge para conexões do banco de dados
const databaseConnections = new promClient.Gauge({
  name: `${monitoringConfig.metrics.prefix}database_connections`,
  help: "Conexões ativas do banco de dados",
  labelNames: ["type", "status"],
  registers: [register],
});

// Gauge para uso de memória
const memoryUsageBytes = new promClient.Gauge({
  name: `${monitoringConfig.metrics.prefix}memory_usage_bytes`,
  help: "Uso de memória em bytes",
  labelNames: ["type"],
  registers: [register],
});

// Gauge para uso de CPU
const cpuUsagePercent = new promClient.Gauge({
  name: `${monitoringConfig.metrics.prefix}cpu_usage_percent`,
  help: "Uso de CPU em porcentagem",
  registers: [register],
});

// Gauge para event loop lag
const eventLoopLag = new promClient.Gauge({
  name: `${monitoringConfig.metrics.prefix}event_loop_lag_seconds`,
  help: "Event loop lag em segundos",
  registers: [register],
});

// Contador de operações NFe por tipo
const nfeOperationsTotal = new promClient.Counter({
  name: `${monitoringConfig.metrics.prefix}nfe_operations_total`,
  help: "Contador de operações NFe por tipo",
  labelNames: ["operation_type", "status", "uf"],
  registers: [register],
});

const dfeFetchTotal = new promClient.Counter({
  name: `${monitoringConfig.metrics.prefix}dfe_fetch_total`,
  help: "Total de buscas DF-e",
  labelNames: ["uf", "success"],
  registers: [register],
});

const dfeFetchDuration = new promClient.Histogram({
  name: `${monitoringConfig.metrics.prefix}dfe_fetch_duration_seconds`,
  help: "Duração de buscas DF-e",
  labelNames: ["uf"],
  buckets: [0.2, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const xsdValidationFailuresTotal = new promClient.Counter({
  name: `${monitoringConfig.metrics.prefix}xsd_validation_failures_total`,
  help: "Falhas de validação XSD por operação",
  labelNames: ["operation", "uf"],
  registers: [register],
});

// Gauge para status do sistema
const systemStatus = new promClient.Gauge({
  name: `${monitoringConfig.metrics.prefix}system_status`,
  help: "Status geral do sistema (1=healthy, 0=unhealthy)",
  labelNames: ["component"],
  registers: [register],
});

// ==================== FUNÇÕES DE COLETA DE MÉTRICAS ====================

/**
 * Coleta métricas de sistema (CPU, memória, etc.)
 */
async function collectSystemMetrics() {
  try {
    // Métricas de processo
    const stats = await pidusage(process.pid);

    // CPU
    cpuUsagePercent.set(stats.cpu);

    // Memória
    memoryUsageBytes.set({ type: "rss" }, process.memoryUsage().rss);
    memoryUsageBytes.set({ type: "heapUsed" }, process.memoryUsage().heapUsed);
    memoryUsageBytes.set(
      { type: "heapTotal" },
      process.memoryUsage().heapTotal,
    );
    memoryUsageBytes.set({ type: "external" }, process.memoryUsage().external);

    // Event loop lag
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e9;
      eventLoopLag.set(lag);
    });
  } catch (error) {
    console.error("❌ Erro ao coletar métricas de sistema:", error);
  }
}

/**
 * Coleta métricas específicas de NFe
 */
async function collectNfeMetrics() {
  try {
    // Verificar status dos certificados
    await updateCertificateMetrics();

    // Verificar conexões de banco
    await updateDatabaseMetrics();

    // Verificar status SEFAZ
    await updateSefazMetrics();
  } catch (error) {
    console.error("❌ Erro ao coletar métricas NFe:", error);
  }
}

/**
 * Atualiza métricas de certificados
 */
async function updateCertificateMetrics() {
  try {
    const certsPath = path.join(__dirname, "../certs");

    try {
      const files = await fs.readdir(certsPath);
      const certFiles = files.filter(
        (file) => file.endsWith(".p12") || file.endsWith(".pfx"),
      );

      for (const certFile of certFiles) {
        // Simular verificação de expiração (implementar lógica real conforme necessário)
        const daysToExpiry = Math.floor(Math.random() * 365); // Placeholder
        certificateExpiryDays.set(
          { certificate_type: "A1", subject: certFile },
          daysToExpiry,
        );
      }
    } catch (error) {
      // Diretório de certificados não existe ou está vazio
      certificateExpiryDays.set({ certificate_type: "A1", subject: "none" }, 0);
    }
  } catch (error) {
    console.error("❌ Erro ao atualizar métricas de certificados:", error);
  }
}

/**
 * Atualiza métricas de banco de dados
 */
async function updateDatabaseMetrics() {
  try {
    // Para MongoDB
    if (process.env.USE_MONGODB === "true") {
      databaseConnections.set({ type: "mongodb", status: "active" }, 1);
      systemStatus.set({ component: "database" }, 1);
    } else {
      // Para arquivo JSON
      databaseConnections.set({ type: "json", status: "active" }, 1);
      systemStatus.set({ component: "database" }, 1);
    }
  } catch (error) {
    console.error("❌ Erro ao atualizar métricas de banco:", error);
    systemStatus.set({ component: "database" }, 0);
  }
}

/**
 * Atualiza métricas SEFAZ
 */
async function updateSefazMetrics() {
  try {
    // Simular verificação de status SEFAZ
    const responseTime = Math.random() * 2; // Placeholder
    sefazResponseTime.set(
      { uf: "SP", service: "NFeAutorizacao4" },
      responseTime,
    );
    systemStatus.set({ component: "sefaz" }, 1);
  } catch (error) {
    console.error("❌ Erro ao atualizar métricas SEFAZ:", error);
    systemStatus.set({ component: "sefaz" }, 0);
  }
}

// ==================== MIDDLEWARE DE MÉTRICAS ====================

/**
 * Middleware para coletar métricas de requisições HTTP
 */
function metricsMiddleware() {
  return (req, res, next) => {
    const start = Date.now();

    // Interceptar o final da resposta
    const originalEnd = res.end;
    res.end = function (...args) {
      const duration = (Date.now() - start) / 1000;

      // Determinar operação NFe
      let operation = "unknown";
      if (req.path.includes("/nfe/")) {
        if (req.path.includes("/emitir")) operation = "emitir";
        else if (req.path.includes("/consultar")) operation = "consultar";
        else if (req.path.includes("/cancelar")) operation = "cancelar";
        else if (req.path.includes("/status")) operation = "status";
      } else if (req.path.includes("/auth/")) {
        operation = "auth";
      }

      // Registrar métricas
      nfeRequestsTotal.inc({
        method: req.method,
        endpoint: req.route?.path || req.path,
        status_code: res.statusCode,
        operation,
      });

      nfeRequestsDuration.observe(
        {
          method: req.method,
          endpoint: req.route?.path || req.path,
          operation,
        },
        duration,
      );

      // Registrar erros
      if (res.statusCode >= 400) {
        nfeErrorsTotal.inc({
          type: res.statusCode >= 500 ? "server_error" : "client_error",
          operation,
          error_code: res.statusCode.toString(),
        });
      }

      originalEnd.apply(this, args);
    };

    next();
  };
}

// ==================== INICIALIZAÇÃO ====================

/**
 * Inicializa o sistema de métricas
 */
function initializeMetrics() {
  if (!monitoringConfig.metrics.enabled) {
    console.log("📊 Métricas desabilitadas");
    return;
  }

  console.log("📊 Inicializando sistema de métricas...");

  // Coletar métricas periodicamente
  setInterval(
    collectSystemMetrics,
    monitoringConfig.metrics.collection.interval,
  );
  setInterval(
    collectNfeMetrics,
    monitoringConfig.metrics.collection.interval * 2,
  );

  // Coleta inicial
  collectSystemMetrics();
  collectNfeMetrics();

  console.log("✅ Sistema de métricas inicializado");
}

// ==================== HANDLERS ====================

/**
 * Handler para endpoint /metrics (Prometheus)
 */
async function metricsHandler(req, res) {
  try {
    res.set("Content-Type", register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    console.error("❌ Erro ao gerar métricas:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Falha ao gerar métricas",
    });
  }
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
  register,
  metrics: {
    nfeRequestsTotal,
    nfeRequestsDuration,
    nfeErrorsTotal,
    sefazResponseTime,
    certificateExpiryDays,
    databaseConnections,
    memoryUsageBytes,
    cpuUsagePercent,
    eventLoopLag,
    nfeOperationsTotal,
  systemStatus,
  dfeFetchTotal,
  dfeFetchDuration,
  xsdValidationFailuresTotal,
  },
  middleware: metricsMiddleware,
  collectors: {
    collectSystemMetrics,
    collectNfeMetrics,
    updateCertificateMetrics,
    updateDatabaseMetrics,
    updateSefazMetrics,
  },
  initialize: initializeMetrics,
  metricsHandler,
  recordDFeFetch: (uf, success, attempts, durationSec) => {
    try {
      dfeFetchTotal.inc({ uf, success: success ? "true" : "false" });
      dfeFetchDuration.observe({ uf }, durationSec || 0);
    } catch {}
  },
  recordXsdFailure: (operation, uf) => {
    try { xsdValidationFailuresTotal.inc({ operation, uf }); } catch {}
  },
};
