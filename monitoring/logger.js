// ==================== SISTEMA DE LOGS AVANÇADO ====================
// Sistema completo de logging com Winston e rotação automática

const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const monitoringConfig = require("../config/monitoring");

// ==================== CONFIGURAÇÃO DE FORMATOS ====================

// Formato para logs em JSON (produção)
const jsonFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS",
  }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ["message", "level", "timestamp", "label"],
  }),
  winston.format.json(),
);

// Formato para logs simples (desenvolvimento)
const simpleFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (stack) {
      log += `\n${stack}`;
    }

    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  }),
);

// ==================== CONFIGURAÇÃO DE TRANSPORTS ====================

/**
 * Cria transport para arquivo com rotação diária
 */
function createFileTransport(filename, level = "info") {
  return new DailyRotateFile({
    filename: path.join(monitoringConfig.logging.directory, filename),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: monitoringConfig.logging.maxSize,
    maxFiles: monitoringConfig.logging.maxFiles,
    level: level,
    format: jsonFormat,
    handleExceptions: level === "error",
    handleRejections: level === "error",
  });
}

// ==================== LOGGERS ESPECIALIZADOS ====================

/**
 * Logger principal da aplicação
 */
const mainLogger = winston.createLogger({
  level: monitoringConfig.logging.level,
  format:
    monitoringConfig.logging.format === "json" ? jsonFormat : simpleFormat,
  defaultMeta: {
    service: "nfe-backend",
    environment: monitoringConfig.environment,
    version: process.env.npm_package_version || "1.0.0",
  },
  transports: [
    // Console (sempre ativo em desenvolvimento)
    new winston.transports.Console({
      format:
        monitoringConfig.environment === "production"
          ? jsonFormat
          : simpleFormat,
    }),

    // Arquivo combinado
    createFileTransport(monitoringConfig.logging.files.combined),

    // Arquivo de erros
    createFileTransport(monitoringConfig.logging.files.error, "error"),
  ],

  // Tratamento de exceções não capturadas
  exceptionHandlers: [
    new winston.transports.Console(),
    createFileTransport("exceptions-%DATE%.log", "error"),
  ],

  // Tratamento de promises rejeitadas
  rejectionHandlers: [
    new winston.transports.Console(),
    createFileTransport("rejections-%DATE%.log", "error"),
  ],
});

/**
 * Logger para segurança
 */
const securityLogger = winston.createLogger({
  level: "info",
  format: jsonFormat,
  defaultMeta: {
    service: "nfe-security",
    environment: monitoringConfig.environment,
  },
  transports: [createFileTransport(monitoringConfig.logging.files.security)],
});

/**
 * Logger para performance
 */
const performanceLogger = winston.createLogger({
  level: "info",
  format: jsonFormat,
  defaultMeta: {
    service: "nfe-performance",
    environment: monitoringConfig.environment,
  },
  transports: [createFileTransport(monitoringConfig.logging.files.performance)],
});

/**
 * Logger específico para NFe
 */
const nfeLogger = winston.createLogger({
  level: "info",
  format: jsonFormat,
  defaultMeta: {
    service: "nfe-operations",
    environment: monitoringConfig.environment,
  },
  transports: [createFileTransport(monitoringConfig.logging.files.nfe)],
});

// ==================== MIDDLEWARE DE LOGGING ====================

/**
 * Middleware para logging de requisições HTTP
 */
function requestLoggingMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    const traceId = generateTraceId();

    // Adicionar trace ID ao request
    req.traceId = traceId;
    res.setHeader("X-Trace-ID", traceId);

    // Log da requisição
    mainLogger.info("Requisição recebida", {
      traceId,
      method: req.method,
      url: req.url,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Interceptar resposta
    const originalSend = res.send;
    res.send = function (data) {
      const duration = Date.now() - start;

      // Log da resposta
      mainLogger.info("Resposta enviada", {
        traceId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get("Content-Length") || 0,
      });

      // Log de performance se demorou muito
      if (duration > 1000) {
        performanceLogger.warn("Requisição lenta detectada", {
          traceId,
          method: req.method,
          url: req.url,
          duration: `${duration}ms`,
          statusCode: res.statusCode,
        });
      }

      originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Middleware para logging de erros
 */
function errorLoggingMiddleware() {
  return (error, req, res, next) => {
    const traceId = req.traceId || generateTraceId();

    mainLogger.error("Erro na aplicação", {
      traceId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
      },
    });

    next(error);
  };
}

// ==================== FUNÇÕES UTILITÁRIAS ====================

/**
 * Gera um trace ID único para correlação de logs
 */
function generateTraceId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log estruturado para operações NFe
 */
function logNfeOperation(operation, data, traceId = null) {
  nfeLogger.info(`NFe ${operation}`, {
    operation,
    traceId: traceId || generateTraceId(),
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Log de segurança
 */
function logSecurityEvent(event, data, level = "info") {
  securityLogger[level](`Evento de segurança: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Log de performance
 */
function logPerformanceMetric(metric, value, unit = "ms", metadata = {}) {
  performanceLogger.info(`Métrica de performance: ${metric}`, {
    metric,
    value,
    unit,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Log de sistema
 */
function logSystemEvent(event, data, level = "info") {
  mainLogger[level](`Evento de sistema: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

// ==================== INICIALIZAÇÃO ====================

/**
 * Inicializa o sistema de logging
 */
function initializeLogging() {
  console.log("📝 Inicializando sistema de logging...");

  // Verificar se o diretório de logs existe
  const fs = require("fs");
  if (!fs.existsSync(monitoringConfig.logging.directory)) {
    fs.mkdirSync(monitoringConfig.logging.directory, { recursive: true });
  }

  // Log inicial
  mainLogger.info("Sistema de logging inicializado", {
    level: monitoringConfig.logging.level,
    format: monitoringConfig.logging.format,
    environment: monitoringConfig.environment,
    logsDirectory: monitoringConfig.logging.directory,
  });

  console.log("✅ Sistema de logging inicializado");
}

// ==================== EXPORTAÇÃO ====================
module.exports = {
  // Loggers principais
  logger: mainLogger,
  securityLogger,
  performanceLogger,
  nfeLogger,

  // Middlewares
  requestLogging: requestLoggingMiddleware,
  errorLogging: errorLoggingMiddleware,

  // Funções utilitárias
  logNfeOperation,
  logSecurityEvent,
  logPerformanceMetric,
  logSystemEvent,
  generateTraceId,

  // Inicialização
  initialize: initializeLogging,
};
