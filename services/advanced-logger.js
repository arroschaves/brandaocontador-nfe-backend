const fs = require("fs");
const path = require("path");
const os = require("os");

class AdvancedLogger {
  constructor() {
    this.logsDir = path.join(__dirname, "..", "logs");
    this.ensureLogDirectories();
  }

  ensureLogDirectories() {
    const categories = [
      "auth",
      "nfe",
      "clientes",
      "certificados",
      "dashboard",
      "produtos",
      "system",
      "cte",
      "mdfe",
      "eventos",
      "relatorios",
    ];
    const types = [
      "errors",
      "warnings",
      "info",
      "frontend",
      "database",
      "validation",
    ];

    // Criar diretório principal de logs se não existir
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Criar subdiretórios por categoria
    categories.forEach((category) => {
      const categoryDir = path.join(this.logsDir, category);
      if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
      }

      // Criar subdiretórios por tipo dentro de cada categoria
      types.forEach((type) => {
        const typeDir = path.join(categoryDir, type);
        if (!fs.existsSync(typeDir)) {
          fs.mkdirSync(typeDir, { recursive: true });
        }
      });
    });

    // Criar diretórios especiais para tipos específicos de erro
    const specialDirs = [
      "uncaught-exceptions",
      "unhandled-rejections",
      "critical-errors",
    ];
    specialDirs.forEach((dir) => {
      const specialDir = path.join(this.logsDir, "system", dir);
      if (!fs.existsSync(specialDir)) {
        fs.mkdirSync(specialDir, { recursive: true });
      }
    });
  }

  getLogFileName(category, type = "errors", subType = null) {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const hour = new Date().getHours().toString().padStart(2, "0");

    if (subType) {
      return path.join(
        this.logsDir,
        category,
        type,
        `${today}_${hour}h_${subType}.json`,
      );
    }

    return path.join(this.logsDir, category, type, `${today}_${hour}h.json`);
  }

  detectCategory(req) {
    const url = req.originalUrl || req.url;

    if (
      url.includes("/api/auth") ||
      url.includes("/login") ||
      url.includes("/logout")
    ) {
      return "auth";
    } else if (url.includes("/api/nfe")) {
      return "nfe";
    } else if (url.includes("/api/clientes")) {
      return "clientes";
    } else if (
      url.includes("/api/me/certificado") ||
      url.includes("/certificado")
    ) {
      return "certificados";
    } else if (url.includes("/api/dashboard")) {
      return "dashboard";
    } else if (url.includes("/api/produtos")) {
      return "produtos";
    } else if (url.includes("/api/cte")) {
      return "cte";
    } else if (url.includes("/api/mdfe")) {
      return "mdfe";
    } else if (url.includes("/api/eventos")) {
      return "eventos";
    } else if (url.includes("/api/relatorios")) {
      return "relatorios";
    } else if (url.includes("/api/me")) {
      return "auth"; // Dados do usuário vão para auth
    } else {
      return "system";
    }
  }

  formatLogEntry(
    level,
    message,
    req = null,
    error = null,
    additionalData = {},
  ) {
    const now = new Date();
    const timestamp = now.toISOString();

    // Capturar informações do sistema
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      loadAverage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
    };

    // Capturar stack trace atual (mesmo sem erro)
    const stack = new Error().stack;
    const stackLines = stack.split("\n");
    const callerInfo = this.extractCallerInfo(stackLines);

    const logEntry = {
      id: this.generateLogId(),
      timestamp,
      timestampMs: now.getTime(),
      level,
      message,
      caller: callerInfo,
      system: systemInfo,
      environment: {
        nodeEnv: process.env.NODE_ENV || "development",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
      },
      ...additionalData,
    };

    // Informações detalhadas da requisição
    if (req) {
      logEntry.request = {
        id: req.id || this.generateRequestId(),
        method: req.method,
        url: req.originalUrl || req.url,
        baseUrl: req.baseUrl,
        path: req.path,
        query: req.query,
        params: req.params,
        protocol: req.protocol,
        secure: req.secure,
        ip:
          req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress,
        ips: req.ips,
        userAgent: req.get("User-Agent"),
        referer: req.get("Referer"),
        origin: req.get("Origin"),
        host: req.get("Host"),
        contentType: req.get("Content-Type"),
        contentLength: req.get("Content-Length"),
        acceptLanguage: req.get("Accept-Language"),
        acceptEncoding: req.get("Accept-Encoding"),
        connection: req.get("Connection"),
        userId: req.user ? req.user.id : null,
        userEmail: req.user ? req.user.email : null,
        userType: req.user ? req.user.tipo : null,
        sessionId: req.sessionID,
        headers: this.sanitizeHeaders(req.headers),
        body: req.method !== "GET" ? this.sanitizeBody(req.body) : undefined,
        cookies: req.cookies,
        fresh: req.fresh,
        stale: req.stale,
        xhr: req.xhr,
        startTime: req.startTime || now.getTime(),
        route: req.route
          ? {
              path: req.route.path,
              methods: req.route.methods,
              stack: req.route.stack?.length || 0,
            }
          : null,
      };
    }

    // Informações detalhadas do erro
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        path: error.path,
        fileName: this.extractFileFromStack(error.stack),
        lineNumber: this.extractLineFromStack(error.stack),
        columnNumber: this.extractColumnFromStack(error.stack),
        stackTrace: this.parseStackTrace(error.stack),
        cause: error.cause,
        isOperational: error.isOperational,
        statusCode: error.statusCode || error.status,
        details: error.details,
        context: error.context,
        timestamp: error.timestamp || timestamp,
        // Capturar propriedades customizadas do erro
        ...Object.getOwnPropertyNames(error).reduce((acc, prop) => {
          if (!["name", "message", "stack"].includes(prop)) {
            acc[prop] = error[prop];
          }
          return acc;
        }, {}),
      };
    }

    return JSON.stringify(logEntry, this.jsonReplacer, 2) + "\n";
  }

  // Gerar ID único para o log
  generateLogId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Gerar ID único para a requisição
  generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Extrair informações do caller
  extractCallerInfo(stackLines) {
    // Pular as primeiras linhas que são do logger
    for (let i = 3; i < stackLines.length; i++) {
      const line = stackLines[i];
      if (line && !line.includes("advanced-logger.js")) {
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
          return {
            function: match[1],
            file: match[2],
            line: parseInt(match[3]),
            column: parseInt(match[4]),
            fullLine: line.trim(),
          };
        }
      }
    }
    return null;
  }

  // Extrair arquivo do stack trace
  extractFileFromStack(stack) {
    if (!stack) return null;
    const match = stack.match(/at\s+.+?\s+\((.+?):(\d+):(\d+)\)/);
    return match ? match[1] : null;
  }

  // Extrair linha do stack trace
  extractLineFromStack(stack) {
    if (!stack) return null;
    const match = stack.match(/at\s+.+?\s+\(.+?:(\d+):(\d+)\)/);
    return match ? parseInt(match[1]) : null;
  }

  // Extrair coluna do stack trace
  extractColumnFromStack(stack) {
    if (!stack) return null;
    const match = stack.match(/at\s+.+?\s+\(.+?:\d+:(\d+)\)/);
    return match ? parseInt(match[1]) : null;
  }

  // Parse completo do stack trace
  parseStackTrace(stack) {
    if (!stack) return [];

    return stack
      .split("\n")
      .slice(1) // Remove a primeira linha (mensagem do erro)
      .map((line) => {
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
          return {
            function: match[1],
            file: match[2],
            line: parseInt(match[3]),
            column: parseInt(match[4]),
            raw: line.trim(),
          };
        }
        return { raw: line.trim() };
      })
      .filter((item) => item.raw);
  }

  // Sanitizar headers removendo informações sensíveis
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "x-api-key",
      "x-auth-token",
    ];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  // Sanitizar body removendo informações sensíveis
  sanitizeBody(body) {
    if (!body) return body;

    const sanitized = JSON.parse(JSON.stringify(body));
    const sensitiveFields = [
      "password",
      "senha",
      "token",
      "secret",
      "key",
      "apiKey",
    ];

    const sanitizeObject = (obj) => {
      if (typeof obj !== "object" || obj === null) return obj;

      Object.keys(obj).forEach((key) => {
        if (
          sensitiveFields.some((field) =>
            key.toLowerCase().includes(field.toLowerCase()),
          )
        ) {
          obj[key] = "[REDACTED]";
        } else if (typeof obj[key] === "object") {
          sanitizeObject(obj[key]);
        }
      });
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  // Replacer para JSON.stringify para lidar com valores especiais
  jsonReplacer(key, value) {
    // Converter BigInt para string
    if (typeof value === "bigint") {
      return value.toString();
    }

    // Converter funções para string
    if (typeof value === "function") {
      return value.toString();
    }

    // Lidar com referências circulares
    if (typeof value === "object" && value !== null) {
      if (this.seen && this.seen.has(value)) {
        return "[Circular Reference]";
      }
      if (!this.seen) this.seen = new WeakSet();
      this.seen.add(value);
    }

    return value;
  }

  writeLog(
    category,
    level,
    message,
    req = null,
    error = null,
    additionalData = {},
  ) {
    try {
      const logEntry = this.formatLogEntry(
        level,
        message,
        req,
        error,
        additionalData,
      );

      // Determinar o tipo de log baseado no level e contexto
      let logType = "info";
      let subType = null;

      if (level === "ERROR") {
        logType = "errors";
        if (error) {
          if (error.name === "ValidationError") subType = "validation";
          else if (error.name === "DatabaseError") subType = "database";
          else if (error.statusCode === 404) subType = "404";
          else if (error.statusCode >= 500) subType = "500";
          else if (error.name === "UnauthorizedError") subType = "auth";
        }
      } else if (level === "WARNING") {
        logType = "warnings";
      } else if (additionalData.frontend) {
        logType = "frontend";
      }

      const fileName = this.getLogFileName(category, logType, subType);

      // Garantir que o diretório existe
      const dir = path.dirname(fileName);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.appendFileSync(fileName, logEntry);

      // Log crítico também vai para arquivo especial
      if (
        level === "ERROR" &&
        error &&
        (error.statusCode >= 500 ||
          error.name === "UnhandledPromiseRejectionWarning")
      ) {
        const criticalFileName = this.getLogFileName(
          "system",
          "critical-errors",
          error.name || "unknown",
        );
        const criticalDir = path.dirname(criticalFileName);
        if (!fs.existsSync(criticalDir)) {
          fs.mkdirSync(criticalDir, { recursive: true });
        }
        fs.appendFileSync(criticalFileName, logEntry);
      }

      // Log também no console para desenvolvimento
      if (process.env.NODE_ENV !== "production") {
        console.log(`[${category.toUpperCase()}] ${level}: ${message}`);
        if (error) {
          console.error(error);
        }
      }
    } catch (writeError) {
      console.error("Erro ao escrever log:", writeError);
      // Tentar salvar o erro de escrita em um arquivo de emergência
      try {
        const emergencyLog = {
          timestamp: new Date().toISOString(),
          error: "LOG_WRITE_ERROR",
          originalMessage: message,
          writeError: writeError.message,
          stack: writeError.stack,
        };
        const emergencyFile = path.join(this.logsDir, "emergency.log");
        fs.appendFileSync(
          emergencyFile,
          JSON.stringify(emergencyLog, null, 2) + "\n",
        );
      } catch (emergencyError) {
        console.error(
          "Erro crítico ao escrever log de emergência:",
          emergencyError,
        );
      }
    }
  }

  logRequest(req, res, next) {
    const category = this.detectCategory(req);
    const startTime = Date.now();

    // Log da requisição
    this.writeLog(
      category,
      "INFO",
      `${req.method} ${req.originalUrl || req.url}`,
      req,
    );

    // Interceptar a resposta para log de erro
    const originalSend = res.send;
    res.send = function (data) {
      const duration = Date.now() - startTime;

      if (res.statusCode >= 400) {
        const logger = req.app.get("advancedLogger");
        logger.writeLog(
          category,
          "ERROR",
          `${req.method} ${req.originalUrl || req.url} - Status: ${res.statusCode}`,
          req,
          null,
          {
            statusCode: res.statusCode,
            duration,
            responseData: data,
          },
        );
      } else {
        const logger = req.app.get("advancedLogger");
        logger.writeLog(
          category,
          "INFO",
          `${req.method} ${req.originalUrl || req.url} - Status: ${res.statusCode}`,
          req,
          null,
          {
            statusCode: res.statusCode,
            duration,
          },
        );
      }

      originalSend.call(this, data);
    };

    next();
  }

  logError(category, message, req = null, error = null, additionalData = {}) {
    this.writeLog(category, "ERROR", message, req, error, additionalData);
  }

  logInfo(category, message, req = null, additionalData = {}) {
    this.writeLog(category, "INFO", message, req, null, additionalData);
  }

  logWarning(category, message, req = null, additionalData = {}) {
    this.writeLog(category, "WARNING", message, req, null, additionalData);
  }

  // Método para obter logs de uma categoria específica
  getLogs(category, type = "errors", date = null) {
    try {
      const targetDate = date || new Date().toISOString().split("T")[0];
      const fileName = path.join(
        this.logsDir,
        category,
        `${targetDate}-${type}.log`,
      );

      if (fs.existsSync(fileName)) {
        const content = fs.readFileSync(fileName, "utf8");
        return content
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return { raw: line };
            }
          });
      }
      return [];
    } catch (error) {
      console.error("Erro ao ler logs:", error);
      return [];
    }
  }

  // Método para obter estatísticas de erros
  getErrorStats(days = 7) {
    const stats = {};
    const categories = [
      "auth",
      "nfe",
      "clientes",
      "certificados",
      "dashboard",
      "produtos",
      "system",
      "cte",
      "mdfe",
      "eventos",
      "relatorios",
    ];

    categories.forEach((category) => {
      stats[category] = { total: 0, byDay: {} };

      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const logs = this.getLogs(category, "errors", dateStr);
        stats[category].byDay[dateStr] = logs.length;
        stats[category].total += logs.length;
      }
    });

    return stats;
  }

  // Método para obter rotas que estão gerando 404
  getMissingRoutes(days = 1) {
    const missingRoutes = new Set();
    const categories = [
      "auth",
      "nfe",
      "clientes",
      "certificados",
      "dashboard",
      "produtos",
      "system",
      "cte",
      "mdfe",
      "eventos",
      "relatorios",
    ];

    categories.forEach((category) => {
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const logs = this.getLogs(category, "errors", dateStr);
        logs.forEach((log) => {
          if (log.statusCode === 404 && log.request) {
            missingRoutes.add(`${log.request.method} ${log.request.url}`);
          }
        });
      }
    });

    return Array.from(missingRoutes);
  }

  // Configurar captura de erros não tratados
  setupGlobalErrorHandlers() {
    // Capturar exceções não tratadas
    process.on("uncaughtException", (error) => {
      this.logError("system", "Exceção não tratada capturada", null, error, {
        type: "uncaughtException",
        critical: true,
        pid: process.pid,
        uptime: process.uptime(),
      });

      // Salvar em arquivo especial
      const fileName = this.getLogFileName(
        "system",
        "uncaught-exceptions",
        "critical",
      );
      const dir = path.dirname(fileName);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const logEntry = this.formatLogEntry(
        "CRITICAL",
        "Uncaught Exception",
        null,
        error,
        {
          type: "uncaughtException",
          processWillExit: true,
        },
      );

      fs.appendFileSync(fileName, logEntry);

      console.error("ERRO CRÍTICO: Exceção não tratada:", error);

      // Dar tempo para o log ser escrito antes de sair
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Capturar promises rejeitadas não tratadas
    process.on("unhandledRejection", (reason, promise) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));

      this.logError("system", "Promise rejeitada não tratada", null, error, {
        type: "unhandledRejection",
        critical: true,
        reason: reason,
        promise: promise.toString(),
        pid: process.pid,
        uptime: process.uptime(),
      });

      // Salvar em arquivo especial
      const fileName = this.getLogFileName(
        "system",
        "unhandled-rejections",
        "critical",
      );
      const dir = path.dirname(fileName);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const logEntry = this.formatLogEntry(
        "CRITICAL",
        "Unhandled Promise Rejection",
        null,
        error,
        {
          type: "unhandledRejection",
          reason: reason,
        },
      );

      fs.appendFileSync(fileName, logEntry);

      console.error("ERRO CRÍTICO: Promise rejeitada não tratada:", reason);
    });

    // Capturar avisos do processo
    process.on("warning", (warning) => {
      this.logWarning("system", "Aviso do processo Node.js", null, {
        type: "processWarning",
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
        code: warning.code,
        detail: warning.detail,
      });
    });

    console.log("✅ Handlers globais de erro configurados");
  }

  // Middleware global para capturar erros do Express
  globalErrorHandler() {
    return (error, req, res, next) => {
      const category = this.detectCategory(req);

      // Log detalhado do erro
      this.logError(
        category,
        "Erro capturado pelo middleware global",
        req,
        error,
        {
          type: "expressError",
          statusCode: error.statusCode || error.status || 500,
          isOperational: error.isOperational || false,
          timestamp: new Date().toISOString(),
        },
      );

      // Determinar status code
      const statusCode = error.statusCode || error.status || 500;

      // Resposta padronizada
      const response = {
        sucesso: false,
        erro:
          process.env.NODE_ENV === "production"
            ? "Erro interno do servidor"
            : error.message,
        codigo: error.code || "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
      };

      // Adicionar stack trace em desenvolvimento
      if (process.env.NODE_ENV !== "production") {
        response.stack = error.stack;
        response.details = error.details;
      }

      res.status(statusCode).json(response);
    };
  }

  // Middleware para capturar 404
  notFoundHandler() {
    return (req, res, next) => {
      const category = this.detectCategory(req);

      this.logWarning(category, "Rota não encontrada", req, {
        type: "404",
        statusCode: 404,
        requestedRoute: `${req.method} ${req.originalUrl || req.url}`,
      });

      res.status(404).json({
        sucesso: false,
        erro: "Rota não encontrada",
        codigo: "ROUTE_NOT_FOUND",
        rota: `${req.method} ${req.originalUrl || req.url}`,
        timestamp: new Date().toISOString(),
      });
    };
  }

  // Método para log de frontend
  logFrontendError(errorData, req = null) {
    this.logError("system", "Erro do frontend", req, null, {
      frontend: true,
      type: "frontendError",
      ...errorData,
    });
  }

  // Método para log de validação
  logValidationError(message, req = null, validationErrors = {}) {
    const error = new Error(message);
    error.name = "ValidationError";
    error.details = validationErrors;

    this.logError(this.detectCategory(req), message, req, error, {
      type: "validation",
      validationErrors,
    });
  }

  // Método para log de banco de dados
  logDatabaseError(message, req = null, dbError = null) {
    const error = dbError || new Error(message);
    error.name = "DatabaseError";

    this.logError(this.detectCategory(req), message, req, error, {
      type: "database",
    });
  }
}

module.exports = AdvancedLogger;
