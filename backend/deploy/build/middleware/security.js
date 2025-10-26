// ==================== MIDDLEWARE DE SEGURANÇA CONSOLIDADO ====================
// Implementa todas as melhorias de segurança críticas da Fase 1
// Helmet, CORS, Rate Limiting, Sanitização, CSRF, Logging de Segurança

// Middleware para tempo de resposta
const responseTime = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.set('X-Response-Time', `${duration}ms`);
  });
  next();
};

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const validator = require('validator');
const crypto = require('crypto');

// ==================== CONFIGURAÇÕES DE AMBIENTE ====================
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_DEVELOPMENT = NODE_ENV === 'development';

// ==================== CLASSE PRINCIPAL DE SEGURANÇA ====================
class SecurityMiddleware {
  constructor() {
    this.csrfTokens = new Map(); // Armazenamento de tokens CSRF
    this.suspiciousIPs = new Map(); // IPs suspeitos
    this.blockedIPs = new Set(); // IPs bloqueados
  }

  // ==================== HELMET - HEADERS DE SEGURANÇA ====================
  
  configurarHelmet() {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"],
          upgradeInsecureRequests: IS_PRODUCTION ? [] : null
        }
      },
      
      // Cross Origin Embedder Policy
      crossOriginEmbedderPolicy: false, // Desabilitado para compatibilidade
      
      // Cross Origin Opener Policy
      crossOriginOpenerPolicy: { policy: "same-origin" },
      
      // Cross Origin Resource Policy
      crossOriginResourcePolicy: { policy: "cross-origin" },
      
      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },
      
      // Frame Guard
      frameguard: { action: 'deny' },
      
      // Hide Powered By
      hidePoweredBy: true,
      
      // HTTP Strict Transport Security
      hsts: IS_PRODUCTION ? {
        maxAge: 31536000, // 1 ano
        includeSubDomains: true,
        preload: true
      } : false,
      
      // IE No Open
      ieNoOpen: true,
      
      // No Sniff
      noSniff: true,
      
      // Origin Agent Cluster
      originAgentCluster: true,
      
      // Permitted Cross Domain Policies
      permittedCrossDomainPolicies: false,
      
      // Referrer Policy
      referrerPolicy: { policy: "no-referrer" },
      
      // X-XSS-Protection
      xssFilter: true
    });
  }

  // ==================== CORS - CONTROLE DE ORIGEM ====================
  
  configurarCORS() {
    const allowedOrigins = this.obterOrigensPermitidas();
    
    return cors({
      origin: (origin, callback) => {
        // Permitir requisições sem origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Verificar se a origem está na lista permitida
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        
        // Log de tentativa de acesso não autorizada
        this.logTentativaAcessoNaoAutorizada(origin);
        
        const erro = new Error(`Origem não permitida pelo CORS: ${origin}`);
        erro.status = 403;
        callback(erro);
      },
      
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-CSRF-Token',
        'X-Forwarded-For',
        'User-Agent'
      ],
      
      exposedHeaders: [
        'X-Total-Count',
        'X-Rate-Limit-Limit',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
      ],
      
      credentials: true,
      maxAge: 86400, // 24 horas
      optionsSuccessStatus: 200
    });
  }

  obterOrigensPermitidas() {
    const origens = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    if (IS_DEVELOPMENT) {
      origens.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      );
    }
    
    if (IS_PRODUCTION) {
      origens.push(
        'https://brandaocontador.com.br',
        'https://www.brandaocontador.com.br',
        'https://nfe.brandaocontador.com.br'
      );
    }
    
    return [...new Set(origens)]; // Remove duplicatas
  }

  // ==================== RATE LIMITING ====================
  
  configurarRateLimitingGlobal() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: IS_PRODUCTION ? 100 : 1000, // Requests por janela
      message: {
        sucesso: false,
        erro: 'Muitas requisições. Tente novamente em alguns minutos.',
        codigo: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Pular rate limiting para IPs confiáveis em desenvolvimento
        if (IS_DEVELOPMENT && this.isIPConfiavel(this.getClientIP(req))) {
          return true;
        }
        return false;
      },
      handler: (req, res, next, options) => {
        this.logRateLimitExcedido(req, 'global');
        this.marcarIPSuspeito(this.getClientIP(req));
        res.status(options.statusCode).json(options.message);
      }
    });
  }

  configurarRateLimitingAuth() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // Máximo 5 tentativas de login
      message: {
        sucesso: false,
        erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        codigo: 'AUTH_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, next, options) => {
        this.logRateLimitExcedido(req, 'auth');
        this.marcarIPSuspeito(this.getClientIP(req), 'auth_abuse');
        res.status(options.statusCode).json(options.message);
      }
    });
  }

  configurarRateLimitingAPI() {
    return rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minuto
      max: IS_PRODUCTION ? 60 : 300, // Requests por minuto
      message: {
        sucesso: false,
        erro: 'Limite de API excedido. Tente novamente em 1 minuto.',
        codigo: 'API_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, next, options) => {
        this.logRateLimitExcedido(req, 'api');
        res.status(options.statusCode).json(options.message);
      }
    });
  }

  // ==================== SLOW DOWN - DESACELERAÇÃO PROGRESSIVA ====================
  
  configurarSlowDown() {
    return slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutos
      delayAfter: IS_PRODUCTION ? 50 : 200, // Começar a desacelerar após N requests
      delayMs: () => 500, // Delay inicial de 500ms
      maxDelayMs: 20000, // Delay máximo de 20 segundos
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
      validate: { delayMs: false } // Desabilitar warning
    });
  }

  // ==================== SANITIZAÇÃO DE ENTRADA ====================
  
  configurarSanitizacao() {
    return [
      // Sanitização contra NoSQL Injection
      mongoSanitize({
        replaceWith: '_',
        onSanitize: ({ req, key }) => {
          this.logTentativaSQLInjection(req, key);
        }
      }),
      
      // Middleware customizado para XSS e validação
      this.sanitizarXSS.bind(this),
      this.validarTiposConteudo.bind(this)
    ];
  }

  sanitizarXSS(req, res, next) {
    try {
      // Sanitizar body
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizarObjeto(req.body);
      }
      
      // Sanitizar query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = this.sanitizarObjeto(req.query);
      }
      
      // Sanitizar params
      if (req.params && typeof req.params === 'object') {
        req.params = this.sanitizarObjeto(req.params);
      }
      
      next();
    } catch (error) {
      this.logErroSanitizacao(req, error);
      res.status(400).json({
        sucesso: false,
        erro: 'Dados de entrada inválidos',
        codigo: 'INVALID_INPUT'
      });
    }
  }

  sanitizarObjeto(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? xss(obj) : obj;
    }
    
    const sanitizado = {};
    
    for (const [chave, valor] of Object.entries(obj)) {
      if (typeof valor === 'string') {
        // Sanitizar XSS
        sanitizado[chave] = xss(valor, {
          whiteList: {}, // Não permitir nenhuma tag HTML
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script']
        });
        
        // Validações adicionais
        if (chave.toLowerCase().includes('email') && valor) {
          if (!validator.isEmail(sanitizado[chave])) {
            throw new Error(`Email inválido: ${chave}`);
          }
        }
        
        if (chave.toLowerCase().includes('url') && valor) {
          if (!validator.isURL(sanitizado[chave])) {
            throw new Error(`URL inválida: ${chave}`);
          }
        }
        
      } else if (Array.isArray(valor)) {
        sanitizado[chave] = valor.map(item => this.sanitizarObjeto(item));
      } else if (typeof valor === 'object') {
        sanitizado[chave] = this.sanitizarObjeto(valor);
      } else {
        sanitizado[chave] = valor;
      }
    }
    
    return sanitizado;
  }

  // ==================== VALIDAÇÃO DE CONTENT-TYPE ====================
  
  validarTiposConteudo(req, res, next) {
    const tiposPermitidos = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain'
    ];
    
    // Verificar apenas para métodos que enviam dados
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('Content-Type');
      
      if (contentType) {
        const tipoBase = contentType.split(';')[0].trim();
        
        if (!tiposPermitidos.includes(tipoBase)) {
          this.logContentTypeInvalido(req, contentType);
          return res.status(415).json({
            sucesso: false,
            erro: 'Tipo de conteúdo não suportado',
            codigo: 'UNSUPPORTED_MEDIA_TYPE'
          });
        }
      }
    }
    
    next();
  }

  // ==================== CSRF PROTECTION ====================
  
  gerarTokenCSRF() {
    return crypto.randomBytes(32).toString('hex');
  }

  configurarCSRF() {
    return (req, res, next) => {
      // Pular CSRF para métodos seguros
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }
      
      // Pular CSRF para API Keys
      if (req.headers['x-api-key']) {
        return next();
      }
      
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      const sessionId = req.sessionID || this.getClientIP(req);
      
      if (!token) {
        return res.status(403).json({
          sucesso: false,
          erro: 'Token CSRF necessário',
          codigo: 'CSRF_TOKEN_REQUIRED'
        });
      }
      
      const tokenValido = this.csrfTokens.get(sessionId);
      
      if (!tokenValido || tokenValido !== token) {
        this.logTentativaCSRF(req);
        return res.status(403).json({
          sucesso: false,
          erro: 'Token CSRF inválido',
          codigo: 'CSRF_TOKEN_INVALID'
        });
      }
      
      next();
    };
  }

  obterTokenCSRF(req, res) {
    const sessionId = req.sessionID || this.getClientIP(req);
    const token = this.gerarTokenCSRF();
    
    this.csrfTokens.set(sessionId, token);
    
    // Limpar tokens antigos periodicamente
    if (this.csrfTokens.size > 1000) {
      const tokens = Array.from(this.csrfTokens.entries());
      this.csrfTokens.clear();
      tokens.slice(-500).forEach(([id, tok]) => this.csrfTokens.set(id, tok));
    }
    
    res.json({
      sucesso: true,
      csrfToken: token
    });
  }

  // ==================== DETECÇÃO DE AMEAÇAS ====================
  
  detectarAmeacas() {
    return (req, res, next) => {
      const ip = this.getClientIP(req);
      const userAgent = req.get('User-Agent') || '';
      const url = req.originalUrl;
      
      // Verificar IP bloqueado
      if (this.blockedIPs.has(ip)) {
        this.logAcessoBloqueado(req);
        return res.status(403).json({
          sucesso: false,
          erro: 'Acesso negado',
          codigo: 'ACCESS_DENIED'
        });
      }
      
      // Detectar padrões suspeitos
      const ameacas = this.analisarRequisicao(req);
      
      if (ameacas.length > 0) {
        this.logAmeacasDetectadas(req, ameacas);
        this.marcarIPSuspeito(ip, ameacas.join(','));
        
        // Bloquear IP se muitas ameaças
        const suspeitas = this.suspiciousIPs.get(ip) || { count: 0 };
        if (suspeitas.count > 5) {
          this.blockedIPs.add(ip);
          this.logIPBloqueado(ip);
        }
      }
      
      next();
    };
  }

  analisarRequisicao(req) {
    const ameacas = [];
    const url = req.originalUrl.toLowerCase();
    const userAgent = (req.get('User-Agent') || '').toLowerCase();
    
    // Detectar tentativas de SQL Injection
    const sqlPatterns = [
      /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/i,
      /(\bdrop\b.*\btable\b)|(\btable\b.*\bdrop\b)/i,
      /(\binsert\b.*\binto\b)|(\binto\b.*\binsert\b)/i,
      /(\bdelete\b.*\bfrom\b)|(\bfrom\b.*\bdelete\b)/i
    ];
    
    if (sqlPatterns.some(pattern => pattern.test(url))) {
      ameacas.push('sql_injection');
    }
    
    // Detectar tentativas de XSS
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi
    ];
    
    if (xssPatterns.some(pattern => pattern.test(url))) {
      ameacas.push('xss_attempt');
    }
    
    // Detectar bots maliciosos
    const botPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /openvas/i,
      /nmap/i
    ];
    
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      ameacas.push('malicious_bot');
    }
    
    // Detectar tentativas de path traversal
    if (url.includes('../') || url.includes('..\\')) {
      ameacas.push('path_traversal');
    }
    
    return ameacas;
  }

  // ==================== UTILITÁRIOS ====================
  
  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] ||
           '127.0.0.1';
  }
  
  isIPConfiavel(ip) {
    const ipsConfiáveis = [
      '127.0.0.1',
      '::1',
      'localhost'
    ];
    return ipsConfiáveis.includes(ip);
  }

  marcarIPSuspeito(ip, motivo = 'rate_limit') {
    const agora = Date.now();
    const suspeita = this.suspiciousIPs.get(ip) || { count: 0, firstSeen: agora, motivos: [] };
    
    suspeita.count++;
    suspeita.lastSeen = agora;
    suspeita.motivos.push(motivo);
    
    this.suspiciousIPs.set(ip, suspeita);
    
    // Limpar IPs antigos periodicamente
    if (this.suspiciousIPs.size > 1000) {
      const umDiaAtras = agora - (24 * 60 * 60 * 1000);
      for (const [ipKey, data] of this.suspiciousIPs.entries()) {
        if (data.lastSeen < umDiaAtras) {
          this.suspiciousIPs.delete(ipKey);
        }
      }
    }
  }

  // ==================== LOGGING DE SEGURANÇA ====================
  
  logTentativaAcessoNaoAutorizada(origin) {
    console.warn(`🚫 CORS: Tentativa de acesso não autorizada de: ${origin}`);
  }

  logRateLimitExcedido(req, tipo) {
    const ip = this.getClientIP(req);
    console.warn(`⚠️ RATE LIMIT: ${tipo} excedido para IP ${ip} - ${req.method} ${req.originalUrl}`);
  }

  logSlowDownAtivado(req) {
    const ip = this.getClientIP(req);
    console.warn(`🐌 SLOW DOWN: Ativado para IP ${ip} - ${req.method} ${req.originalUrl}`);
  }

  logTentativaSQLInjection(req, key) {
    const ip = this.getClientIP(req);
    console.warn(`💉 SQL INJECTION: Tentativa detectada de IP ${ip} - Campo: ${key}`);
  }

  logErroSanitizacao(req, error) {
    const ip = this.getClientIP(req);
    console.error(`🧹 SANITIZAÇÃO: Erro para IP ${ip} - ${error.message}`);
  }

  logContentTypeInvalido(req, contentType) {
    const ip = this.getClientIP(req);
    console.warn(`📄 CONTENT-TYPE: Inválido de IP ${ip} - ${contentType}`);
  }

  logTentativaCSRF(req) {
    const ip = this.getClientIP(req);
    console.warn(`🛡️ CSRF: Tentativa de ataque de IP ${ip} - ${req.method} ${req.originalUrl}`);
  }

  logAcessoBloqueado(req) {
    const ip = this.getClientIP(req);
    console.warn(`🚫 ACESSO BLOQUEADO: IP ${ip} - ${req.method} ${req.originalUrl}`);
  }

  logAmeacasDetectadas(req, ameacas) {
    const ip = this.getClientIP(req);
    console.warn(`⚠️ AMEAÇAS: ${ameacas.join(', ')} detectadas de IP ${ip} - ${req.originalUrl}`);
  }

  logIPBloqueado(ip) {
    console.warn(`🔒 IP BLOQUEADO: ${ip} foi bloqueado por atividade suspeita`);
  }

  // ==================== STATUS E MONITORAMENTO ====================
  
  obterStatusSeguranca() {
    return {
      ipsMonitorados: this.suspiciousIPs.size,
      ipsBloqueados: this.blockedIPs.size,
      tokensCSRF: this.csrfTokens.size,
      ambiente: NODE_ENV,
      producao: IS_PRODUCTION
    };
  }
}

// ==================== EXPORTAÇÃO ====================
const securityMiddleware = new SecurityMiddleware();

module.exports = {
  responseTime,
  configurarHelmet: securityMiddleware.configurarHelmet.bind(securityMiddleware),
  configurarCORS: securityMiddleware.configurarCORS.bind(securityMiddleware),
  configurarRateLimitingGlobal: securityMiddleware.configurarRateLimitingGlobal.bind(securityMiddleware),
  configurarRateLimitingAuth: securityMiddleware.configurarRateLimitingAuth.bind(securityMiddleware),
  configurarRateLimitingAPI: securityMiddleware.configurarRateLimitingAPI.bind(securityMiddleware),
  configurarSlowDown: securityMiddleware.configurarSlowDown.bind(securityMiddleware),
  configurarSanitizacao: securityMiddleware.configurarSanitizacao.bind(securityMiddleware),
  detectarAmeacas: securityMiddleware.detectarAmeacas.bind(securityMiddleware),
  obterStatusSeguranca: securityMiddleware.obterStatusSeguranca.bind(securityMiddleware)
};