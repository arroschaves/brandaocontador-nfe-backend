const fs = require('fs');
const path = require('path');
const readline = require('readline');

class LogAnalyzer {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.logsDir = path.join(projectRoot, 'logs');
    this.srcDir = path.join(projectRoot, 'src');
    this.routesDir = path.join(projectRoot, 'routes');
    
    // Padrões de log comuns
    this.logPatterns = {
      error: /\b(error|err|exception|fail|fatal)\b/i,
      warning: /\b(warn|warning|deprecated)\b/i,
      info: /\b(info|information)\b/i,
      debug: /\b(debug|trace)\b/i,
      performance: /\b(slow|timeout|performance|latency|duration)\b/i,
      security: /\b(unauthorized|forbidden|authentication|security|breach)\b/i,
      database: /\b(database|db|sql|query|connection)\b/i,
      api: /\b(api|endpoint|request|response|http)\b/i
    };

    // Padrões de anomalias
    this.anomalyPatterns = {
      repeatedErrors: /(.+error.+)/i,
      memoryLeaks: /\b(memory|heap|gc|garbage)\b/i,
      connectionIssues: /\b(connection|timeout|refused|reset)\b/i,
      authenticationFailures: /\b(auth|login|unauthorized|forbidden)\b/i,
      performanceIssues: /\b(slow|timeout|latency|performance)\b/i
    };

    // Métricas de performance esperadas
    this.performanceThresholds = {
      responseTime: 1000, // ms
      errorRate: 0.05, // 5%
      memoryUsage: 0.8, // 80%
      cpuUsage: 0.8 // 80%
    };
  }

  async analyze() {
    try {
      console.log('🔍 Iniciando análise de logs...');

      const results = {
        logFiles: await this.analyzeLogFiles(),
        patterns: await this.analyzeLogPatterns(),
        anomalies: await this.detectAnomalies(),
        performance: await this.analyzePerformanceMetrics(),
        security: await this.analyzeSecurityEvents(),
        trends: await this.analyzeTrends(),
        alerts: await this.generateAlerts(),
        recommendations: [],
        summary: {}
      };

      results.recommendations = this.generateRecommendations(results);
      results.summary = this.calculateSummary(results);

      await this.saveReport(results);

      console.log('✅ Análise de logs concluída');
      return results;

    } catch (error) {
      console.error('❌ Erro durante análise de logs:', error.message);
      throw error;
    }
  }

  async analyzeLogFiles() {
    const issues = [];
    const logFiles = [];

    try {
      // Verifica se diretório de logs existe
      if (!fs.existsSync(this.logsDir)) {
        issues.push({
          type: 'log_files',
          severity: 'medium',
          issue: 'no_logs_directory',
          message: 'Diretório de logs não encontrado',
          recommendation: 'Criar estrutura de logs organizada'
        });
        return { issues, logFiles };
      }

      // Analisa arquivos de log existentes
      const files = fs.readdirSync(this.logsDir);
      const logFileExtensions = ['.log', '.txt', '.out'];
      
      for (const file of files) {
        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && logFileExtensions.some(ext => file.endsWith(ext))) {
          const logFile = await this.analyzeLogFile(filePath);
          logFiles.push(logFile);
          
          this.validateLogFile(logFile, issues);
        }
      }

      // Verifica estrutura de logs recomendada
      this.checkLogStructure(issues);
      this.checkLogRotation(logFiles, issues);

    } catch (error) {
      issues.push({
        type: 'log_files',
        severity: 'high',
        issue: 'analysis_error',
        message: `Erro ao analisar arquivos de log: ${error.message}`
      });
    }

    return { issues, logFiles };
  }

  async analyzeLogFile(filePath) {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    const logFile = {
      name: fileName,
      path: filePath,
      size: stats.size,
      lastModified: stats.mtime,
      lineCount: 0,
      logLevels: {
        error: 0,
        warning: 0,
        info: 0,
        debug: 0
      },
      hasTimestamps: false,
      hasStructuredFormat: false,
      encoding: 'utf8'
    };

    try {
      // Analisa uma amostra do arquivo para determinar características
      const sampleSize = Math.min(stats.size, 10000); // Primeiros 10KB
      const buffer = Buffer.alloc(sampleSize);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, sampleSize, 0);
      fs.closeSync(fd);
      
      const sampleContent = buffer.toString('utf8');
      
      // Detecta formato e características
      logFile.hasTimestamps = this.detectTimestamps(sampleContent);
      logFile.hasStructuredFormat = this.detectStructuredFormat(sampleContent);
      
      // Conta linhas e níveis de log (amostra)
      const lines = sampleContent.split('\n');
      logFile.lineCount = Math.round((stats.size / sampleSize) * lines.length);
      
      for (const line of lines) {
        this.categorizeLogLine(line, logFile.logLevels);
      }

    } catch (error) {
      console.error(`Erro ao analisar arquivo ${fileName}:`, error.message);
    }

    return logFile;
  }

  detectTimestamps(content) {
    // Padrões comuns de timestamp
    const timestampPatterns = [
      /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/,  // ISO format
      /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/,   // US format
      /\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/,     // EU format
      /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/  // Bracketed format
    ];

    return timestampPatterns.some(pattern => pattern.test(content));
  }

  detectStructuredFormat(content) {
    // Detecta formatos estruturados como JSON
    try {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) return false;
      
      // Testa se pelo menos 50% das linhas são JSON válido
      let jsonLines = 0;
      const sampleLines = lines.slice(0, 10);
      
      for (const line of sampleLines) {
        try {
          JSON.parse(line);
          jsonLines++;
        } catch (e) {
          // Não é JSON
        }
      }
      
      return jsonLines / sampleLines.length >= 0.5;
    } catch (error) {
      return false;
    }
  }

  categorizeLogLine(line, logLevels) {
    const lowerLine = line.toLowerCase();
    
    if (this.logPatterns.error.test(lowerLine)) {
      logLevels.error++;
    } else if (this.logPatterns.warning.test(lowerLine)) {
      logLevels.warning++;
    } else if (this.logPatterns.debug.test(lowerLine)) {
      logLevels.debug++;
    } else if (this.logPatterns.info.test(lowerLine)) {
      logLevels.info++;
    }
  }

  validateLogFile(logFile, issues) {
    // Verifica se arquivo é muito grande
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (logFile.size > maxSize) {
      issues.push({
        type: 'log_files',
        severity: 'medium',
        issue: 'large_log_file',
        message: `Arquivo de log ${logFile.name} é muito grande (${Math.round(logFile.size / 1024 / 1024)}MB)`,
        file: logFile.name,
        size: logFile.size,
        recommendation: 'Implementar rotação de logs'
      });
    }

    // Verifica se arquivo não foi modificado recentemente
    const daysSinceModified = (Date.now() - logFile.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 7) {
      issues.push({
        type: 'log_files',
        severity: 'low',
        issue: 'stale_log_file',
        message: `Arquivo de log ${logFile.name} não foi modificado há ${Math.round(daysSinceModified)} dias`,
        file: logFile.name,
        lastModified: logFile.lastModified,
        recommendation: 'Verificar se aplicação está gerando logs corretamente'
      });
    }

    // Verifica formato estruturado
    if (!logFile.hasStructuredFormat && !logFile.hasTimestamps) {
      issues.push({
        type: 'log_files',
        severity: 'medium',
        issue: 'unstructured_logs',
        message: `Arquivo de log ${logFile.name} não possui formato estruturado`,
        file: logFile.name,
        recommendation: 'Implementar logging estruturado com timestamps'
      });
    }

    // Verifica alta taxa de erros
    const totalLogs = Object.values(logFile.logLevels).reduce((a, b) => a + b, 0);
    if (totalLogs > 0) {
      const errorRate = logFile.logLevels.error / totalLogs;
      if (errorRate > this.performanceThresholds.errorRate) {
        issues.push({
          type: 'log_files',
          severity: 'high',
          issue: 'high_error_rate',
          message: `Arquivo de log ${logFile.name} possui alta taxa de erros (${Math.round(errorRate * 100)}%)`,
          file: logFile.name,
          errorRate: errorRate,
          recommendation: 'Investigar e corrigir erros frequentes'
        });
      }
    }
  }

  checkLogStructure(issues) {
    const recommendedStructure = [
      'application.log',
      'error.log',
      'access.log',
      'debug.log'
    ];

    const missingFiles = recommendedStructure.filter(file => 
      !fs.existsSync(path.join(this.logsDir, file))
    );

    if (missingFiles.length > 0) {
      issues.push({
        type: 'log_files',
        severity: 'low',
        issue: 'incomplete_log_structure',
        message: 'Estrutura de logs recomendada incompleta',
        missingFiles: missingFiles,
        recommendation: 'Implementar separação de logs por tipo (application, error, access, debug)'
      });
    }
  }

  checkLogRotation(logFiles, issues) {
    // Verifica se existe rotação de logs baseada em arquivos numerados ou datados
    const rotatedFiles = logFiles.filter(file => 
      /\.\d+$/.test(file.name) || /\d{4}-\d{2}-\d{2}/.test(file.name)
    );

    if (rotatedFiles.length === 0 && logFiles.length > 0) {
      issues.push({
        type: 'log_files',
        severity: 'medium',
        issue: 'no_log_rotation',
        message: 'Rotação de logs não configurada',
        recommendation: 'Configurar rotação automática de logs para evitar arquivos muito grandes'
      });
    }
  }

  async analyzeLogPatterns() {
    const issues = [];
    const patterns = {
      error: [],
      warning: [],
      performance: [],
      security: [],
      database: [],
      api: []
    };

    try {
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        await this.extractPatterns(logFile, patterns);
      }

      this.analyzePatternFrequency(patterns, issues);
      this.identifyCommonIssues(patterns, issues);

    } catch (error) {
      issues.push({
        type: 'patterns',
        severity: 'high',
        issue: 'analysis_error',
        message: `Erro ao analisar padrões de log: ${error.message}`
      });
    }

    return { issues, patterns };
  }

  async getLogFiles() {
    if (!fs.existsSync(this.logsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.logsDir);
    return files
      .filter(file => file.endsWith('.log') || file.endsWith('.txt'))
      .map(file => path.join(this.logsDir, file))
      .filter(filePath => fs.statSync(filePath).isFile());
  }

  async extractPatterns(logFilePath, patterns) {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    
    for await (const line of rl) {
      lineNumber++;
      
      // Limita análise para evitar processamento excessivo
      if (lineNumber > 10000) break;
      
      this.categorizeLogPattern(line, patterns, logFilePath, lineNumber);
    }
  }

  categorizeLogPattern(line, patterns, filePath, lineNumber) {
    const fileName = path.basename(filePath);
    
    for (const [category, pattern] of Object.entries(this.logPatterns)) {
      if (pattern.test(line)) {
        if (!patterns[category]) {
          patterns[category] = [];
        }
        
        patterns[category].push({
          line: line.trim(),
          file: fileName,
          lineNumber: lineNumber,
          timestamp: this.extractTimestamp(line)
        });
      }
    }
  }

  extractTimestamp(line) {
    const timestampPatterns = [
      /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/,
      /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/,
      /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/
    ];

    for (const pattern of timestampPatterns) {
      const match = line.match(pattern);
      if (match) {
        return new Date(match[1]);
      }
    }
    
    return null;
  }

  analyzePatternFrequency(patterns, issues) {
    for (const [category, entries] of Object.entries(patterns)) {
      if (entries.length === 0) continue;
      
      // Agrupa por mensagem similar
      const groupedPatterns = this.groupSimilarPatterns(entries);
      
      for (const [pattern, occurrences] of Object.entries(groupedPatterns)) {
        if (occurrences.length > 10) { // Mais de 10 ocorrências
          const severity = this.getSeverityByCategory(category, occurrences.length);
          
          issues.push({
            type: 'patterns',
            severity: severity,
            issue: 'frequent_pattern',
            category: category,
            pattern: pattern,
            occurrences: occurrences.length,
            message: `Padrão frequente detectado: ${pattern} (${occurrences.length} ocorrências)`,
            recommendation: this.getRecommendationByCategory(category)
          });
        }
      }
    }
  }

  groupSimilarPatterns(entries) {
    const groups = {};
    
    for (const entry of entries) {
      // Normaliza a linha removendo timestamps, números, etc.
      const normalized = entry.line
        .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?/g, '[TIMESTAMP]')
        .replace(/\d+/g, '[NUMBER]')
        .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '[UUID]')
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
      
      if (!groups[normalized]) {
        groups[normalized] = [];
      }
      groups[normalized].push(entry);
    }
    
    return groups;
  }

  getSeverityByCategory(category, occurrences) {
    if (category === 'error' && occurrences > 50) return 'high';
    if (category === 'security' && occurrences > 5) return 'high';
    if (category === 'performance' && occurrences > 20) return 'medium';
    if (occurrences > 100) return 'medium';
    return 'low';
  }

  getRecommendationByCategory(category) {
    const recommendations = {
      error: 'Investigar e corrigir a causa raiz dos erros',
      warning: 'Revisar warnings para prevenir problemas futuros',
      performance: 'Otimizar performance para reduzir latência',
      security: 'Investigar eventos de segurança imediatamente',
      database: 'Otimizar queries e conexões de banco de dados',
      api: 'Monitorar e otimizar endpoints de API'
    };
    
    return recommendations[category] || 'Investigar padrão identificado';
  }

  identifyCommonIssues(patterns, issues) {
    // Identifica issues comuns baseados nos padrões
    
    // Erros de conexão de banco
    const dbErrors = patterns.error?.filter(entry => 
      /database|connection|sql/i.test(entry.line)
    ) || [];
    
    if (dbErrors.length > 5) {
      issues.push({
        type: 'patterns',
        severity: 'high',
        issue: 'database_connection_issues',
        message: `${dbErrors.length} erros de conexão com banco de dados detectados`,
        occurrences: dbErrors.length,
        recommendation: 'Verificar configuração e estabilidade da conexão com banco de dados'
      });
    }

    // Timeouts de API
    const timeoutErrors = patterns.error?.filter(entry => 
      /timeout|timed out/i.test(entry.line)
    ) || [];
    
    if (timeoutErrors.length > 3) {
      issues.push({
        type: 'patterns',
        severity: 'medium',
        issue: 'api_timeout_issues',
        message: `${timeoutErrors.length} timeouts de API detectados`,
        occurrences: timeoutErrors.length,
        recommendation: 'Aumentar timeouts ou otimizar performance das APIs'
      });
    }

    // Falhas de autenticação
    const authErrors = patterns.security?.filter(entry => 
      /unauthorized|authentication|forbidden/i.test(entry.line)
    ) || [];
    
    if (authErrors.length > 10) {
      issues.push({
        type: 'patterns',
        severity: 'high',
        issue: 'authentication_failures',
        message: `${authErrors.length} falhas de autenticação detectadas`,
        occurrences: authErrors.length,
        recommendation: 'Investigar tentativas de acesso não autorizado'
      });
    }
  }

  async detectAnomalies() {
    const issues = [];
    const anomalies = [];

    try {
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        const fileAnomalies = await this.detectFileAnomalies(logFile);
        anomalies.push(...fileAnomalies);
      }

      this.analyzeAnomalyPatterns(anomalies, issues);
      this.detectTimeBasedAnomalies(anomalies, issues);

    } catch (error) {
      issues.push({
        type: 'anomalies',
        severity: 'high',
        issue: 'analysis_error',
        message: `Erro ao detectar anomalias: ${error.message}`
      });
    }

    return { issues, anomalies };
  }

  async detectFileAnomalies(logFilePath) {
    const anomalies = [];
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    const recentLines = [];
    const maxRecentLines = 100;
    
    for await (const line of rl) {
      lineNumber++;
      
      // Mantém buffer de linhas recentes
      recentLines.push({ line, lineNumber });
      if (recentLines.length > maxRecentLines) {
        recentLines.shift();
      }
      
      // Detecta anomalias específicas
      this.detectLineAnomalies(line, lineNumber, logFilePath, anomalies);
      
      // Detecta padrões repetitivos
      if (recentLines.length >= 5) {
        this.detectRepetitivePatterns(recentLines, logFilePath, anomalies);
      }
      
      // Limita processamento
      if (lineNumber > 50000) break;
    }

    return anomalies;
  }

  detectLineAnomalies(line, lineNumber, filePath, anomalies) {
    const fileName = path.basename(filePath);
    
    // Detecta stack traces longos
    if (/^\s+at\s+/.test(line)) {
      const lastAnomaly = anomalies[anomalies.length - 1];
      if (lastAnomaly && lastAnomaly.type === 'stack_trace') {
        lastAnomaly.lines.push(lineNumber);
        lastAnomaly.endLine = lineNumber;
      } else {
        anomalies.push({
          type: 'stack_trace',
          file: fileName,
          startLine: lineNumber,
          endLine: lineNumber,
          lines: [lineNumber],
          severity: 'medium'
        });
      }
    }

    // Detecta memory leaks
    if (this.anomalyPatterns.memoryLeaks.test(line)) {
      anomalies.push({
        type: 'memory_issue',
        file: fileName,
        line: lineNumber,
        content: line.trim(),
        severity: 'high'
      });
    }

    // Detecta problemas de conexão
    if (this.anomalyPatterns.connectionIssues.test(line)) {
      anomalies.push({
        type: 'connection_issue',
        file: fileName,
        line: lineNumber,
        content: line.trim(),
        severity: 'medium'
      });
    }

    // Detecta falhas de autenticação
    if (this.anomalyPatterns.authenticationFailures.test(line)) {
      anomalies.push({
        type: 'auth_failure',
        file: fileName,
        line: lineNumber,
        content: line.trim(),
        severity: 'high'
      });
    }
  }

  detectRepetitivePatterns(recentLines, filePath, anomalies) {
    const fileName = path.basename(filePath);
    
    // Verifica se as últimas 5 linhas são muito similares
    const lastFive = recentLines.slice(-5);
    const normalizedLines = lastFive.map(entry => 
      entry.line.replace(/\d+/g, '[NUM]').replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g, '[TIME]')
    );
    
    const uniqueLines = new Set(normalizedLines);
    if (uniqueLines.size === 1 && lastFive.length === 5) {
      anomalies.push({
        type: 'repetitive_pattern',
        file: fileName,
        startLine: lastFive[0].lineNumber,
        endLine: lastFive[4].lineNumber,
        pattern: normalizedLines[0],
        severity: 'medium'
      });
    }
  }

  analyzeAnomalyPatterns(anomalies, issues) {
    // Agrupa anomalias por tipo
    const anomalyGroups = {};
    
    for (const anomaly of anomalies) {
      if (!anomalyGroups[anomaly.type]) {
        anomalyGroups[anomaly.type] = [];
      }
      anomalyGroups[anomaly.type].push(anomaly);
    }

    // Analisa cada grupo
    for (const [type, group] of Object.entries(anomalyGroups)) {
      if (group.length > 5) {
        issues.push({
          type: 'anomalies',
          severity: this.getAnomalySeverity(type, group.length),
          issue: 'frequent_anomaly',
          anomalyType: type,
          occurrences: group.length,
          message: `Anomalia frequente detectada: ${type} (${group.length} ocorrências)`,
          recommendation: this.getAnomalyRecommendation(type)
        });
      }
    }
  }

  getAnomalySeverity(type, count) {
    if (type === 'memory_issue' && count > 3) return 'critical';
    if (type === 'auth_failure' && count > 10) return 'high';
    if (count > 20) return 'high';
    if (count > 10) return 'medium';
    return 'low';
  }

  getAnomalyRecommendation(type) {
    const recommendations = {
      stack_trace: 'Investigar e corrigir erros que causam stack traces',
      memory_issue: 'Investigar vazamentos de memória e otimizar uso de recursos',
      connection_issue: 'Verificar estabilidade de conexões de rede e banco de dados',
      auth_failure: 'Investigar tentativas de acesso não autorizado',
      repetitive_pattern: 'Investigar loops infinitos ou problemas de configuração'
    };
    
    return recommendations[type] || 'Investigar anomalia detectada';
  }

  detectTimeBasedAnomalies(anomalies, issues) {
    // Agrupa anomalias por hora para detectar picos
    const hourlyAnomalies = {};
    
    for (const anomaly of anomalies) {
      if (anomaly.timestamp) {
        const hour = anomaly.timestamp.getHours();
        if (!hourlyAnomalies[hour]) {
          hourlyAnomalies[hour] = 0;
        }
        hourlyAnomalies[hour]++;
      }
    }

    // Detecta picos de anomalias
    const avgAnomalies = Object.values(hourlyAnomalies).reduce((a, b) => a + b, 0) / 24;
    
    for (const [hour, count] of Object.entries(hourlyAnomalies)) {
      if (count > avgAnomalies * 3) { // 3x a média
        issues.push({
          type: 'anomalies',
          severity: 'medium',
          issue: 'anomaly_spike',
          hour: parseInt(hour),
          count: count,
          average: Math.round(avgAnomalies),
          message: `Pico de anomalias detectado às ${hour}h (${count} vs média de ${Math.round(avgAnomalies)})`,
          recommendation: 'Investigar causa do pico de anomalias no horário específico'
        });
      }
    }
  }

  async analyzePerformanceMetrics() {
    const issues = [];
    const metrics = {
      responseTime: [],
      errorRate: [],
      throughput: [],
      resourceUsage: []
    };

    try {
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        await this.extractPerformanceMetrics(logFile, metrics);
      }

      this.analyzeResponseTimes(metrics.responseTime, issues);
      this.analyzeErrorRates(metrics.errorRate, issues);
      this.analyzeThroughput(metrics.throughput, issues);
      this.analyzeResourceUsage(metrics.resourceUsage, issues);

    } catch (error) {
      issues.push({
        type: 'performance',
        severity: 'high',
        issue: 'analysis_error',
        message: `Erro ao analisar métricas de performance: ${error.message}`
      });
    }

    return { issues, metrics };
  }

  async extractPerformanceMetrics(logFilePath, metrics) {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      this.extractResponseTime(line, metrics.responseTime);
      this.extractErrorRate(line, metrics.errorRate);
      this.extractThroughput(line, metrics.throughput);
      this.extractResourceUsage(line, metrics.resourceUsage);
    }
  }

  extractResponseTime(line, responseTimeMetrics) {
    // Padrões comuns para tempo de resposta
    const patterns = [
      /response time[:\s]+(\d+)ms/i,
      /duration[:\s]+(\d+)ms/i,
      /took[:\s]+(\d+)ms/i,
      /(\d+)ms/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const responseTime = parseInt(match[1]);
        if (responseTime > 0 && responseTime < 60000) { // Sanity check
          responseTimeMetrics.push({
            value: responseTime,
            timestamp: this.extractTimestamp(line),
            line: line.trim()
          });
          break;
        }
      }
    }
  }

  extractErrorRate(line, errorRateMetrics) {
    if (this.logPatterns.error.test(line)) {
      errorRateMetrics.push({
        timestamp: this.extractTimestamp(line),
        line: line.trim()
      });
    }
  }

  extractThroughput(line, throughputMetrics) {
    // Detecta requests por segundo ou similar
    const patterns = [
      /(\d+)\s+requests?\/s/i,
      /throughput[:\s]+(\d+)/i,
      /rps[:\s]+(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        throughputMetrics.push({
          value: parseInt(match[1]),
          timestamp: this.extractTimestamp(line),
          line: line.trim()
        });
        break;
      }
    }
  }

  extractResourceUsage(line, resourceUsageMetrics) {
    // Detecta uso de CPU, memória, etc.
    const patterns = [
      /cpu[:\s]+(\d+)%/i,
      /memory[:\s]+(\d+)%/i,
      /heap[:\s]+(\d+)mb/i,
      /disk[:\s]+(\d+)%/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        resourceUsageMetrics.push({
          type: pattern.source.split('[')[0],
          value: parseInt(match[1]),
          timestamp: this.extractTimestamp(line),
          line: line.trim()
        });
        break;
      }
    }
  }

  analyzeResponseTimes(responseTimeMetrics, issues) {
    if (responseTimeMetrics.length === 0) return;

    const responseTimes = responseTimeMetrics.map(m => m.value);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    if (avgResponseTime > this.performanceThresholds.responseTime) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        issue: 'high_average_response_time',
        averageResponseTime: Math.round(avgResponseTime),
        threshold: this.performanceThresholds.responseTime,
        message: `Tempo de resposta médio alto: ${Math.round(avgResponseTime)}ms (limite: ${this.performanceThresholds.responseTime}ms)`,
        recommendation: 'Otimizar performance da aplicação para reduzir tempo de resposta'
      });
    }

    if (maxResponseTime > this.performanceThresholds.responseTime * 5) {
      issues.push({
        type: 'performance',
        severity: 'high',
        issue: 'very_slow_requests',
        maxResponseTime: maxResponseTime,
        threshold: this.performanceThresholds.responseTime * 5,
        message: `Requests muito lentos detectados: ${maxResponseTime}ms`,
        recommendation: 'Investigar e otimizar requests extremamente lentos'
      });
    }
  }

  analyzeErrorRates(errorRateMetrics, issues) {
    if (errorRateMetrics.length === 0) return;

    // Calcula taxa de erro por hora
    const hourlyErrors = {};
    
    for (const error of errorRateMetrics) {
      if (error.timestamp) {
        const hour = error.timestamp.getHours();
        if (!hourlyErrors[hour]) {
          hourlyErrors[hour] = 0;
        }
        hourlyErrors[hour]++;
      }
    }

    const avgErrorsPerHour = Object.values(hourlyErrors).reduce((a, b) => a + b, 0) / 24;
    
    if (avgErrorsPerHour > 10) {
      issues.push({
        type: 'performance',
        severity: 'high',
        issue: 'high_error_rate',
        averageErrorsPerHour: Math.round(avgErrorsPerHour),
        totalErrors: errorRateMetrics.length,
        message: `Alta taxa de erros: ${Math.round(avgErrorsPerHour)} erros/hora em média`,
        recommendation: 'Investigar e corrigir causas dos erros frequentes'
      });
    }
  }

  analyzeThroughput(throughputMetrics, issues) {
    if (throughputMetrics.length === 0) return;

    const throughputValues = throughputMetrics.map(m => m.value);
    const avgThroughput = throughputValues.reduce((a, b) => a + b, 0) / throughputValues.length;
    const minThroughput = Math.min(...throughputValues);
    
    if (minThroughput < avgThroughput * 0.5) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        issue: 'throughput_degradation',
        averageThroughput: Math.round(avgThroughput),
        minimumThroughput: minThroughput,
        message: `Degradação de throughput detectada: mínimo ${minThroughput} vs média ${Math.round(avgThroughput)}`,
        recommendation: 'Investigar causas da degradação de throughput'
      });
    }
  }

  analyzeResourceUsage(resourceUsageMetrics, issues) {
    const resourceGroups = {};
    
    for (const metric of resourceUsageMetrics) {
      if (!resourceGroups[metric.type]) {
        resourceGroups[metric.type] = [];
      }
      resourceGroups[metric.type].push(metric.value);
    }

    for (const [resourceType, values] of Object.entries(resourceGroups)) {
      const maxUsage = Math.max(...values);
      const avgUsage = values.reduce((a, b) => a + b, 0) / values.length;
      
      if (maxUsage > 90) {
        issues.push({
          type: 'performance',
          severity: 'high',
          issue: 'high_resource_usage',
          resourceType: resourceType,
          maxUsage: maxUsage,
          averageUsage: Math.round(avgUsage),
          message: `Alto uso de ${resourceType}: ${maxUsage}% (média: ${Math.round(avgUsage)}%)`,
          recommendation: `Otimizar uso de ${resourceType} ou aumentar recursos disponíveis`
        });
      }
    }
  }

  async analyzeSecurityEvents() {
    const issues = [];
    const securityEvents = [];

    try {
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        const events = await this.extractSecurityEvents(logFile);
        securityEvents.push(...events);
      }

      this.analyzeAuthenticationFailures(securityEvents, issues);
      this.analyzeUnauthorizedAccess(securityEvents, issues);
      this.analyzeSuspiciousActivity(securityEvents, issues);

    } catch (error) {
      issues.push({
        type: 'security',
        severity: 'high',
        issue: 'analysis_error',
        message: `Erro ao analisar eventos de segurança: ${error.message}`
      });
    }

    return { issues, securityEvents };
  }

  async extractSecurityEvents(logFilePath) {
    const securityEvents = [];
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    
    for await (const line of rl) {
      lineNumber++;
      
      if (this.logPatterns.security.test(line)) {
        securityEvents.push({
          line: line.trim(),
          file: path.basename(logFilePath),
          lineNumber: lineNumber,
          timestamp: this.extractTimestamp(line),
          type: this.classifySecurityEvent(line)
        });
      }
      
      if (lineNumber > 100000) break;
    }

    return securityEvents;
  }

  classifySecurityEvent(line) {
    const lowerLine = line.toLowerCase();
    
    if (/unauthorized|401/.test(lowerLine)) return 'unauthorized_access';
    if (/forbidden|403/.test(lowerLine)) return 'forbidden_access';
    if (/authentication|login|auth/.test(lowerLine)) return 'authentication';
    if (/security|breach|attack/.test(lowerLine)) return 'security_incident';
    
    return 'general_security';
  }

  analyzeAuthenticationFailures(securityEvents, issues) {
    const authFailures = securityEvents.filter(event => 
      event.type === 'authentication' || event.type === 'unauthorized_access'
    );

    if (authFailures.length > 20) {
      issues.push({
        type: 'security',
        severity: 'high',
        issue: 'excessive_auth_failures',
        count: authFailures.length,
        message: `${authFailures.length} falhas de autenticação detectadas`,
        recommendation: 'Investigar tentativas de acesso não autorizado e considerar implementar rate limiting'
      });
    }

    // Analisa padrões temporais
    const hourlyFailures = {};
    for (const failure of authFailures) {
      if (failure.timestamp) {
        const hour = failure.timestamp.getHours();
        if (!hourlyFailures[hour]) {
          hourlyFailures[hour] = 0;
        }
        hourlyFailures[hour]++;
      }
    }

    const maxFailuresInHour = Math.max(...Object.values(hourlyFailures));
    if (maxFailuresInHour > 10) {
      issues.push({
        type: 'security',
        severity: 'high',
        issue: 'auth_failure_spike',
        maxFailuresInHour: maxFailuresInHour,
        message: `Pico de falhas de autenticação: ${maxFailuresInHour} em uma hora`,
        recommendation: 'Investigar possível ataque de força bruta'
      });
    }
  }

  analyzeUnauthorizedAccess(securityEvents, issues) {
    const unauthorizedEvents = securityEvents.filter(event => 
      event.type === 'forbidden_access'
    );

    if (unauthorizedEvents.length > 10) {
      issues.push({
        type: 'security',
        severity: 'medium',
        issue: 'unauthorized_access_attempts',
        count: unauthorizedEvents.length,
        message: `${unauthorizedEvents.length} tentativas de acesso não autorizado`,
        recommendation: 'Revisar permissões e controles de acesso'
      });
    }
  }

  analyzeSuspiciousActivity(securityEvents, issues) {
    const suspiciousEvents = securityEvents.filter(event => 
      event.type === 'security_incident'
    );

    if (suspiciousEvents.length > 0) {
      issues.push({
        type: 'security',
        severity: 'critical',
        issue: 'suspicious_security_activity',
        count: suspiciousEvents.length,
        message: `${suspiciousEvents.length} eventos de segurança suspeitos detectados`,
        recommendation: 'Investigar imediatamente eventos de segurança suspeitos'
      });
    }
  }

  async analyzeTrends() {
    const issues = [];
    const trends = {
      errorTrends: [],
      performanceTrends: [],
      volumeTrends: []
    };

    try {
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        await this.extractTrendData(logFile, trends);
      }

      this.analyzeErrorTrends(trends.errorTrends, issues);
      this.analyzePerformanceTrends(trends.performanceTrends, issues);
      this.analyzeVolumeTrends(trends.volumeTrends, issues);

    } catch (error) {
      issues.push({
        type: 'trends',
        severity: 'medium',
        issue: 'analysis_error',
        message: `Erro ao analisar tendências: ${error.message}`
      });
    }

    return { issues, trends };
  }

  async extractTrendData(logFilePath, trends) {
    const fileStream = fs.createReadStream(logFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const hourlyData = {};
    
    for await (const line of rl) {
      const timestamp = this.extractTimestamp(line);
      if (!timestamp) continue;
      
      const hour = timestamp.getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          errors: 0,
          total: 0,
          responseTimes: []
        };
      }
      
      hourlyData[hour].total++;
      
      if (this.logPatterns.error.test(line)) {
        hourlyData[hour].errors++;
      }
      
      const responseTimeMatch = line.match(/(\d+)ms/);
      if (responseTimeMatch) {
        hourlyData[hour].responseTimes.push(parseInt(responseTimeMatch[1]));
      }
    }

    // Converte dados horários em tendências
    for (const [hour, data] of Object.entries(hourlyData)) {
      trends.errorTrends.push({
        hour: parseInt(hour),
        errorRate: data.total > 0 ? data.errors / data.total : 0,
        errorCount: data.errors
      });
      
      if (data.responseTimes.length > 0) {
        const avgResponseTime = data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length;
        trends.performanceTrends.push({
          hour: parseInt(hour),
          averageResponseTime: avgResponseTime
        });
      }
      
      trends.volumeTrends.push({
        hour: parseInt(hour),
        volume: data.total
      });
    }
  }

  analyzeErrorTrends(errorTrends, issues) {
    if (errorTrends.length < 2) return;

    // Calcula tendência de crescimento de erros
    const sortedTrends = errorTrends.sort((a, b) => a.hour - b.hour);
    let increasingHours = 0;
    
    for (let i = 1; i < sortedTrends.length; i++) {
      if (sortedTrends[i].errorRate > sortedTrends[i-1].errorRate) {
        increasingHours++;
      }
    }

    const increasingPercentage = increasingHours / (sortedTrends.length - 1);
    
    if (increasingPercentage > 0.6) {
      issues.push({
        type: 'trends',
        severity: 'high',
        issue: 'increasing_error_trend',
        increasingPercentage: Math.round(increasingPercentage * 100),
        message: `Tendência crescente de erros detectada (${Math.round(increasingPercentage * 100)}% das horas)`,
        recommendation: 'Investigar causa do aumento progressivo de erros'
      });
    }
  }

  analyzePerformanceTrends(performanceTrends, issues) {
    if (performanceTrends.length < 2) return;

    const sortedTrends = performanceTrends.sort((a, b) => a.hour - b.hour);
    let degradingHours = 0;
    
    for (let i = 1; i < sortedTrends.length; i++) {
      if (sortedTrends[i].averageResponseTime > sortedTrends[i-1].averageResponseTime) {
        degradingHours++;
      }
    }

    const degradingPercentage = degradingHours / (sortedTrends.length - 1);
    
    if (degradingPercentage > 0.6) {
      issues.push({
        type: 'trends',
        severity: 'medium',
        issue: 'degrading_performance_trend',
        degradingPercentage: Math.round(degradingPercentage * 100),
        message: `Tendência de degradação de performance detectada (${Math.round(degradingPercentage * 100)}% das horas)`,
        recommendation: 'Investigar causa da degradação progressiva de performance'
      });
    }
  }

  analyzeVolumeTrends(volumeTrends, issues) {
    if (volumeTrends.length < 2) return;

    const volumes = volumeTrends.map(t => t.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const maxVolume = Math.max(...volumes);
    const minVolume = Math.min(...volumes);
    
    // Detecta picos de volume
    if (maxVolume > avgVolume * 3) {
      issues.push({
        type: 'trends',
        severity: 'medium',
        issue: 'volume_spike',
        maxVolume: maxVolume,
        averageVolume: Math.round(avgVolume),
        message: `Pico de volume detectado: ${maxVolume} vs média de ${Math.round(avgVolume)}`,
        recommendation: 'Investigar causa do pico de volume e preparar para escalabilidade'
      });
    }

    // Detecta quedas de volume
    if (minVolume < avgVolume * 0.3 && avgVolume > 10) {
      issues.push({
        type: 'trends',
        severity: 'medium',
        issue: 'volume_drop',
        minVolume: minVolume,
        averageVolume: Math.round(avgVolume),
        message: `Queda significativa de volume detectada: ${minVolume} vs média de ${Math.round(avgVolume)}`,
        recommendation: 'Investigar causa da queda de volume'
      });
    }
  }

  async generateAlerts() {
    const alerts = [];

    try {
      // Gera alertas baseados em análises anteriores
      const logFiles = await this.analyzeLogFiles();
      const patterns = await this.analyzeLogPatterns();
      const anomalies = await this.detectAnomalies();
      const performance = await this.analyzePerformanceMetrics();
      const security = await this.analyzeSecurityEvents();

      // Alertas críticos
      this.generateCriticalAlerts(security.issues, alerts);
      this.generatePerformanceAlerts(performance.issues, alerts);
      this.generateSecurityAlerts(security.issues, alerts);
      this.generateAnomalyAlerts(anomalies.issues, alerts);

    } catch (error) {
      alerts.push({
        type: 'system',
        severity: 'high',
        message: `Erro ao gerar alertas: ${error.message}`,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  generateCriticalAlerts(securityIssues, alerts) {
    const criticalIssues = securityIssues.filter(issue => issue.severity === 'critical');
    
    for (const issue of criticalIssues) {
      alerts.push({
        type: 'critical',
        severity: 'critical',
        message: `ALERTA CRÍTICO: ${issue.message}`,
        issue: issue.issue,
        recommendation: issue.recommendation,
        timestamp: new Date()
      });
    }
  }

  generatePerformanceAlerts(performanceIssues, alerts) {
    const highPerformanceIssues = performanceIssues.filter(issue => 
      issue.severity === 'high' && issue.type === 'performance'
    );
    
    for (const issue of highPerformanceIssues) {
      alerts.push({
        type: 'performance',
        severity: 'high',
        message: `ALERTA DE PERFORMANCE: ${issue.message}`,
        issue: issue.issue,
        recommendation: issue.recommendation,
        timestamp: new Date()
      });
    }
  }

  generateSecurityAlerts(securityIssues, alerts) {
    const securityAlerts = securityIssues.filter(issue => 
      issue.severity === 'high' || issue.severity === 'critical'
    );
    
    for (const issue of securityAlerts) {
      alerts.push({
        type: 'security',
        severity: issue.severity,
        message: `ALERTA DE SEGURANÇA: ${issue.message}`,
        issue: issue.issue,
        recommendation: issue.recommendation,
        timestamp: new Date()
      });
    }
  }

  generateAnomalyAlerts(anomalyIssues, alerts) {
    const highAnomalies = anomalyIssues.filter(issue => 
      issue.severity === 'high' || issue.severity === 'critical'
    );
    
    for (const issue of highAnomalies) {
      alerts.push({
        type: 'anomaly',
        severity: issue.severity,
        message: `ALERTA DE ANOMALIA: ${issue.message}`,
        issue: issue.issue,
        recommendation: issue.recommendation,
        timestamp: new Date()
      });
    }
  }

  calculateSummary(results) {
    const allIssues = [
      ...results.logFiles.issues,
      ...results.patterns.issues,
      ...results.anomalies.issues,
      ...results.performance.issues,
      ...results.security.issues,
      ...results.trends.issues
    ];

    const severityCounts = {
      critical: allIssues.filter(issue => issue.severity === 'critical').length,
      high: allIssues.filter(issue => issue.severity === 'high').length,
      medium: allIssues.filter(issue => issue.severity === 'medium').length,
      low: allIssues.filter(issue => issue.severity === 'low').length
    };

    const typeCounts = {
      log_files: results.logFiles.issues.length,
      patterns: results.patterns.issues.length,
      anomalies: results.anomalies.issues.length,
      performance: results.performance.issues.length,
      security: results.security.issues.length,
      trends: results.trends.issues.length
    };

    return {
      totalIssues: allIssues.length,
      severityCounts,
      typeCounts,
      logHealthScore: this.calculateLogHealthScore(severityCounts, results),
      alertCount: results.alerts.length,
      criticalAlerts: results.alerts.filter(alert => alert.severity === 'critical').length,
      healthLevel: this.getHealthLevel(severityCounts, results.alerts)
    };
  }

  calculateLogHealthScore(severityCounts, results) {
    let score = 100;
    
    // Penaliza por issues
    score -= severityCounts.critical * 25;
    score -= severityCounts.high * 15;
    score -= severityCounts.medium * 8;
    score -= severityCounts.low * 3;
    
    // Penaliza por alertas críticos
    const criticalAlerts = results.alerts.filter(alert => alert.severity === 'critical').length;
    score -= criticalAlerts * 20;
    
    // Bonus por estrutura de logs adequada
    if (results.logFiles.logFiles.length > 0) {
      const structuredLogs = results.logFiles.logFiles.filter(log => log.hasStructuredFormat).length;
      const structureBonus = Math.round((structuredLogs / results.logFiles.logFiles.length) * 10);
      score += structureBonus;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  getHealthLevel(severityCounts, alerts) {
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical').length;
    
    if (severityCounts.critical > 0 || criticalAlerts > 0) {
      return 'Crítico';
    } else if (severityCounts.high > 5) {
      return 'Ruim';
    } else if (severityCounts.high > 2 || severityCounts.medium > 10) {
      return 'Regular';
    } else if (severityCounts.medium > 5) {
      return 'Bom';
    } else {
      return 'Excelente';
    }
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    // Recomendações baseadas em alertas críticos
    const criticalAlerts = results.alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push({
        category: 'Crítico',
        priority: 'critical',
        title: 'Resolver alertas críticos imediatamente',
        description: `${criticalAlerts.length} alertas críticos detectados`,
        actions: [
          'Investigar e resolver alertas críticos de segurança',
          'Implementar monitoramento em tempo real',
          'Configurar notificações automáticas para alertas críticos'
        ]
      });
    }

    // Recomendações baseadas em estrutura de logs
    const logFileIssues = results.logFiles.issues;
    const structureIssues = logFileIssues.filter(issue => 
      issue.issue === 'unstructured_logs' || issue.issue === 'no_logs_directory'
    );
    
    if (structureIssues.length > 0) {
      recommendations.push({
        category: 'Estrutura de Logs',
        priority: 'high',
        title: 'Melhorar estrutura de logging',
        description: 'Sistema de logs precisa de melhorias estruturais',
        actions: [
          'Implementar logging estruturado com JSON',
          'Configurar rotação automática de logs',
          'Separar logs por tipo (error, access, debug)',
          'Adicionar timestamps consistentes'
        ]
      });
    }

    // Recomendações baseadas em performance
    const performanceIssues = results.performance.issues;
    const highPerformanceIssues = performanceIssues.filter(issue => issue.severity === 'high');
    
    if (highPerformanceIssues.length > 0) {
      recommendations.push({
        category: 'Performance',
        priority: 'high',
        title: 'Otimizar performance da aplicação',
        description: `${highPerformanceIssues.length} problemas críticos de performance`,
        actions: [
          'Otimizar queries e operações lentas',
          'Implementar cache onde apropriado',
          'Monitorar e alertar sobre degradação de performance',
          'Configurar limites de timeout adequados'
        ]
      });
    }

    // Recomendações baseadas em segurança
    const securityIssues = results.security.issues;
    const highSecurityIssues = securityIssues.filter(issue => 
      issue.severity === 'high' || issue.severity === 'critical'
    );
    
    if (highSecurityIssues.length > 0) {
      recommendations.push({
        category: 'Segurança',
        priority: 'critical',
        title: 'Fortalecer segurança da aplicação',
        description: `${highSecurityIssues.length} problemas de segurança detectados`,
        actions: [
          'Implementar rate limiting para prevenir ataques',
          'Configurar alertas para falhas de autenticação',
          'Revisar e fortalecer controles de acesso',
          'Implementar monitoramento de segurança em tempo real'
        ]
      });
    }

    // Recomendações baseadas em anomalias
    const anomalyIssues = results.anomalies.issues;
    const frequentAnomalies = anomalyIssues.filter(issue => issue.issue === 'frequent_anomaly');
    
    if (frequentAnomalies.length > 0) {
      recommendations.push({
        category: 'Anomalias',
        priority: 'medium',
        title: 'Investigar e corrigir anomalias',
        description: `${frequentAnomalies.length} tipos de anomalias frequentes`,
        actions: [
          'Investigar causas raiz das anomalias',
          'Implementar correções preventivas',
          'Configurar alertas para anomalias críticas',
          'Melhorar tratamento de erros'
        ]
      });
    }

    return recommendations;
  }

  async saveReport(results) {
    try {
      const reportPath = path.join(this.projectRoot, 'log-analysis-report.json');
      
      const report = {
        timestamp: new Date().toISOString(),
        projectRoot: this.projectRoot,
        results,
        metadata: {
          analyzer: 'LogAnalyzer',
          version: '1.0.0'
        }
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Relatório salvo: ${reportPath}`);

    } catch (error) {
      console.error('Erro ao salvar relatório:', error.message);
    }
  }
}

module.exports = LogAnalyzer;