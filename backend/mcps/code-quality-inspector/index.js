const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * MCP Code Quality Inspector
 * Analisa complexidade ciclomática, detecta code smells, métricas de maintainability
 */
class CodeQualityInspector {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.excludePatterns = options.excludePatterns || [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      'tests',
      'test'
    ];
    
    this.fileExtensions = options.fileExtensions || ['.js', '.ts', '.jsx', '.tsx'];
    this.maxComplexity = options.maxComplexity || 10;
    this.maxFunctionLength = options.maxFunctionLength || 50;
    this.maxFileLength = options.maxFileLength || 500;
    this.duplicateThreshold = options.duplicateThreshold || 0.05; // 5%
    
    this.codeSmells = {
      longFunction: [],
      longFile: [],
      highComplexity: [],
      duplicateCode: [],
      largeClass: [],
      tooManyParameters: [],
      deepNesting: [],
      longParameterList: [],
      dataClumps: [],
      featureEnvy: []
    };
    
    this.metrics = {
      totalFiles: 0,
      totalLines: 0,
      totalFunctions: 0,
      averageComplexity: 0,
      maintainabilityIndex: 0,
      technicalDebt: 0
    };
  }

  /**
   * Executa análise completa de qualidade de código
   */
  async analyze() {
    console.log('🔍 Iniciando análise de qualidade de código...');
    
    const startTime = Date.now();
    
    try {
      // Coleta arquivos para análise
      const files = await this.collectFiles();
      console.log(`📁 Analisando ${files.length} arquivos...`);
      
      // Analisa cada arquivo
      for (const file of files) {
        await this.analyzeFile(file);
      }
      
      // Calcula métricas gerais
      this.calculateMetrics();
      
      // Detecta duplicação de código
      await this.detectCodeDuplication(files);
      
      // Gera relatório
      const report = this.generateReport();
      report.analysisTime = Date.now() - startTime;
      
      console.log('✅ Análise de qualidade concluída');
      
      return report;
      
    } catch (error) {
      console.error('❌ Erro durante análise:', error.message);
      throw error;
    }
  }

  /**
   * Coleta arquivos para análise
   */
  async collectFiles() {
    const files = [];
    
    const collectFromDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!this.shouldSkipDirectory(item)) {
            collectFromDir(fullPath);
          }
        } else if (stat.isFile()) {
          if (this.shouldAnalyzeFile(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    collectFromDir(this.projectRoot);
    return files;
  }

  /**
   * Verifica se deve pular diretório
   */
  shouldSkipDirectory(dirName) {
    return this.excludePatterns.some(pattern => dirName.includes(pattern));
  }

  /**
   * Verifica se deve analisar arquivo
   */
  shouldAnalyzeFile(filePath) {
    const ext = path.extname(filePath);
    return this.fileExtensions.includes(ext) && !this.shouldSkipFile(filePath);
  }

  /**
   * Verifica se deve pular arquivo
   */
  shouldSkipFile(filePath) {
    return this.excludePatterns.some(pattern => filePath.includes(pattern));
  }

  /**
   * Analisa um arquivo específico
   */
  async analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      this.metrics.totalFiles++;
      this.metrics.totalLines += lines.length;
      
      // Analisa estrutura do arquivo
      const fileAnalysis = this.analyzeFileStructure(content, filePath);
      
      // Verifica code smells específicos do arquivo
      this.detectFileCodeSmells(fileAnalysis, filePath);
      
      // Analisa funções
      const functions = this.extractFunctions(content);
      this.metrics.totalFunctions += functions.length;
      
      for (const func of functions) {
        this.analyzeFunction(func, filePath);
      }
      
    } catch (error) {
      console.warn(`⚠️ Erro ao analisar ${filePath}: ${error.message}`);
    }
  }

  /**
   * Analisa estrutura do arquivo
   */
  analyzeFileStructure(content, filePath) {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    const commentLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    });
    
    return {
      filePath,
      totalLines: lines.length,
      codeLines: nonEmptyLines.length,
      commentLines: commentLines.length,
      commentRatio: commentLines.length / nonEmptyLines.length,
      content
    };
  }

  /**
   * Detecta code smells no arquivo
   */
  detectFileCodeSmells(fileAnalysis, filePath) {
    // Arquivo muito longo
    if (fileAnalysis.totalLines > this.maxFileLength) {
      this.codeSmells.longFile.push({
        file: filePath,
        lines: fileAnalysis.totalLines,
        severity: fileAnalysis.totalLines > this.maxFileLength * 2 ? 'high' : 'medium',
        message: `Arquivo muito longo (${fileAnalysis.totalLines} linhas)`
      });
    }
    
    // Baixa cobertura de comentários
    if (fileAnalysis.commentRatio < 0.1 && fileAnalysis.codeLines > 50) {
      this.codeSmells.featureEnvy.push({
        file: filePath,
        commentRatio: fileAnalysis.commentRatio,
        severity: 'low',
        message: `Baixa cobertura de comentários (${(fileAnalysis.commentRatio * 100).toFixed(1)}%)`
      });
    }
  }

  /**
   * Extrai funções do código
   */
  extractFunctions(content) {
    const functions = [];
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\([^)]*\)\s*=>)|(?:async\s+)?(\w+)\s*\([^)]*\)\s*{)/g;
    
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3];
      const startIndex = match.index;
      
      // Encontra o final da função
      const functionContent = this.extractFunctionBody(content, startIndex);
      
      if (functionContent) {
        functions.push({
          name: functionName,
          startIndex,
          content: functionContent,
          lines: functionContent.split('\n').length
        });
      }
    }
    
    return functions;
  }

  /**
   * Extrai corpo da função
   */
  extractFunctionBody(content, startIndex) {
    let braceCount = 0;
    let inFunction = false;
    let functionBody = '';
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        braceCount++;
        inFunction = true;
      } else if (char === '}') {
        braceCount--;
      }
      
      if (inFunction) {
        functionBody += char;
      }
      
      if (inFunction && braceCount === 0) {
        break;
      }
    }
    
    return functionBody;
  }

  /**
   * Analisa uma função específica
   */
  analyzeFunction(func, filePath) {
    // Complexidade ciclomática
    const complexity = this.calculateCyclomaticComplexity(func.content);
    
    // Função muito longa
    if (func.lines > this.maxFunctionLength) {
      this.codeSmells.longFunction.push({
        file: filePath,
        function: func.name,
        lines: func.lines,
        severity: func.lines > this.maxFunctionLength * 2 ? 'high' : 'medium',
        message: `Função muito longa (${func.lines} linhas)`
      });
    }
    
    // Alta complexidade
    if (complexity > this.maxComplexity) {
      this.codeSmells.highComplexity.push({
        file: filePath,
        function: func.name,
        complexity: complexity,
        severity: complexity > this.maxComplexity * 2 ? 'high' : 'medium',
        message: `Alta complexidade ciclomática (${complexity})`
      });
    }
    
    // Muitos parâmetros
    const parameterCount = this.countParameters(func.content);
    if (parameterCount > 5) {
      this.codeSmells.tooManyParameters.push({
        file: filePath,
        function: func.name,
        parameters: parameterCount,
        severity: parameterCount > 8 ? 'high' : 'medium',
        message: `Muitos parâmetros (${parameterCount})`
      });
    }
    
    // Aninhamento profundo
    const nestingLevel = this.calculateNestingLevel(func.content);
    if (nestingLevel > 4) {
      this.codeSmells.deepNesting.push({
        file: filePath,
        function: func.name,
        nestingLevel: nestingLevel,
        severity: nestingLevel > 6 ? 'high' : 'medium',
        message: `Aninhamento muito profundo (${nestingLevel} níveis)`
      });
    }
  }

  /**
   * Calcula complexidade ciclomática
   */
  calculateCyclomaticComplexity(code) {
    // Conta pontos de decisão
    const decisionPoints = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bdo\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b\?\s*:/g, // operador ternário
      /\b&&\b/g,
      /\b\|\|\b/g
    ];
    
    let complexity = 1; // Complexidade base
    
    for (const pattern of decisionPoints) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  /**
   * Conta parâmetros de uma função
   */
  countParameters(functionContent) {
    const paramMatch = functionContent.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1].trim()) {
      return 0;
    }
    
    const params = paramMatch[1].split(',').filter(p => p.trim().length > 0);
    return params.length;
  }

  /**
   * Calcula nível de aninhamento
   */
  calculateNestingLevel(code) {
    let maxLevel = 0;
    let currentLevel = 0;
    
    for (const char of code) {
      if (char === '{') {
        currentLevel++;
        maxLevel = Math.max(maxLevel, currentLevel);
      } else if (char === '}') {
        currentLevel--;
      }
    }
    
    return maxLevel;
  }

  /**
   * Detecta duplicação de código
   */
  async detectCodeDuplication(files) {
    console.log('🔍 Detectando duplicação de código...');
    
    const codeBlocks = new Map();
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const blocks = this.extractCodeBlocks(content, file);
        
        for (const block of blocks) {
          const hash = this.hashCodeBlock(block.content);
          
          if (codeBlocks.has(hash)) {
            const existing = codeBlocks.get(hash);
            
            // Verifica se não é o mesmo arquivo
            if (existing.file !== block.file) {
              this.codeSmells.duplicateCode.push({
                file1: existing.file,
                file2: block.file,
                content: block.content.substring(0, 100) + '...',
                lines: block.lines,
                severity: block.lines > 10 ? 'high' : 'medium',
                message: `Código duplicado encontrado (${block.lines} linhas)`
              });
            }
          } else {
            codeBlocks.set(hash, block);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao analisar duplicação em ${file}: ${error.message}`);
      }
    }
  }

  /**
   * Extrai blocos de código para análise de duplicação
   */
  extractCodeBlocks(content, file) {
    const lines = content.split('\n');
    const blocks = [];
    const minBlockSize = 5; // Mínimo de 5 linhas
    
    for (let i = 0; i <= lines.length - minBlockSize; i++) {
      const blockLines = lines.slice(i, i + minBlockSize);
      const blockContent = blockLines.join('\n').trim();
      
      // Ignora blocos vazios ou só com comentários
      if (blockContent.length > 50 && !this.isOnlyComments(blockContent)) {
        blocks.push({
          file,
          startLine: i + 1,
          lines: minBlockSize,
          content: blockContent
        });
      }
    }
    
    return blocks;
  }

  /**
   * Verifica se o bloco contém apenas comentários
   */
  isOnlyComments(content) {
    const lines = content.split('\n');
    const codeLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('//') && 
             !trimmed.startsWith('/*') && 
             !trimmed.startsWith('*');
    });
    
    return codeLines.length === 0;
  }

  /**
   * Gera hash para bloco de código
   */
  hashCodeBlock(content) {
    // Remove espaços e quebras de linha para comparação
    const normalized = content.replace(/\s+/g, ' ').trim();
    
    // Hash simples
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converte para 32bit
    }
    
    return hash.toString();
  }

  /**
   * Calcula métricas gerais
   */
  calculateMetrics() {
    // Complexidade média
    const complexitySum = [
      ...this.codeSmells.highComplexity.map(s => s.complexity),
      ...Array(this.metrics.totalFunctions - this.codeSmells.highComplexity.length).fill(5) // Assume complexidade 5 para funções normais
    ].reduce((sum, c) => sum + c, 0);
    
    this.metrics.averageComplexity = this.metrics.totalFunctions > 0 ? 
      complexitySum / this.metrics.totalFunctions : 0;
    
    // Índice de manutenibilidade (simplificado)
    const codeSmellCount = Object.values(this.codeSmells).reduce((sum, smells) => sum + smells.length, 0);
    const smellRatio = this.metrics.totalFiles > 0 ? codeSmellCount / this.metrics.totalFiles : 0;
    
    this.metrics.maintainabilityIndex = Math.max(0, 100 - (smellRatio * 10) - (this.metrics.averageComplexity * 2));
    
    // Dívida técnica (em horas estimadas)
    this.metrics.technicalDebt = this.estimateTechnicalDebt();
  }

  /**
   * Estima dívida técnica
   */
  estimateTechnicalDebt() {
    let debt = 0;
    
    // Funções longas: 30 min cada
    debt += this.codeSmells.longFunction.length * 0.5;
    
    // Arquivos longos: 1 hora cada
    debt += this.codeSmells.longFile.length * 1;
    
    // Alta complexidade: 45 min cada
    debt += this.codeSmells.highComplexity.length * 0.75;
    
    // Código duplicado: 20 min cada
    debt += this.codeSmells.duplicateCode.length * 0.33;
    
    // Muitos parâmetros: 15 min cada
    debt += this.codeSmells.tooManyParameters.length * 0.25;
    
    // Aninhamento profundo: 30 min cada
    debt += this.codeSmells.deepNesting.length * 0.5;
    
    return Math.round(debt * 10) / 10; // Arredonda para 1 casa decimal
  }

  /**
   * Gera relatório completo
   */
  generateReport() {
    const totalSmells = Object.values(this.codeSmells).reduce((sum, smells) => sum + smells.length, 0);
    const criticalSmells = this.getCriticalSmells();
    const highSmells = this.getHighSeveritySmells();
    const mediumSmells = this.getMediumSeveritySmells();
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.metrics.totalFiles,
        totalLines: this.metrics.totalLines,
        totalFunctions: this.metrics.totalFunctions,
        totalCodeSmells: totalSmells,
        criticalIssues: criticalSmells.length,
        highIssues: highSmells.length,
        mediumIssues: mediumSmells.length,
        averageComplexity: this.metrics.averageComplexity,
        maintainabilityIndex: this.metrics.maintainabilityIndex,
        technicalDebtHours: this.metrics.technicalDebt
      },
      metrics: this.metrics,
      codeSmells: this.codeSmells,
      qualityGrade: this.calculateQualityGrade(),
      recommendations: this.generateRecommendations(),
      topIssues: this.getTopIssues()
    };
  }

  /**
   * Obtém code smells críticos
   */
  getCriticalSmells() {
    const critical = [];
    
    // Complexidade muito alta (>20)
    critical.push(...this.codeSmells.highComplexity.filter(s => s.complexity > 20));
    
    // Arquivos muito longos (>1000 linhas)
    critical.push(...this.codeSmells.longFile.filter(s => s.lines > 1000));
    
    // Funções muito longas (>100 linhas)
    critical.push(...this.codeSmells.longFunction.filter(s => s.lines > 100));
    
    return critical;
  }

  /**
   * Obtém code smells de alta severidade
   */
  getHighSeveritySmells() {
    const high = [];
    
    Object.values(this.codeSmells).forEach(smells => {
      high.push(...smells.filter(s => s.severity === 'high'));
    });
    
    return high;
  }

  /**
   * Obtém code smells de média severidade
   */
  getMediumSeveritySmells() {
    const medium = [];
    
    Object.values(this.codeSmells).forEach(smells => {
      medium.push(...smells.filter(s => s.severity === 'medium'));
    });
    
    return medium;
  }

  /**
   * Calcula nota de qualidade
   */
  calculateQualityGrade() {
    const score = this.metrics.maintainabilityIndex;
    
    if (score >= 90) return { grade: 'A', description: 'Excelente' };
    if (score >= 80) return { grade: 'B', description: 'Bom' };
    if (score >= 70) return { grade: 'C', description: 'Regular' };
    if (score >= 60) return { grade: 'D', description: 'Ruim' };
    return { grade: 'F', description: 'Crítico' };
  }

  /**
   * Gera recomendações
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Complexidade alta
    if (this.codeSmells.highComplexity.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'complexity',
        action: 'Reduzir complexidade ciclomática',
        details: `${this.codeSmells.highComplexity.length} funções com alta complexidade`,
        effort: 'medium'
      });
    }
    
    // Funções longas
    if (this.codeSmells.longFunction.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'structure',
        action: 'Quebrar funções longas',
        details: `${this.codeSmells.longFunction.length} funções muito longas`,
        effort: 'medium'
      });
    }
    
    // Código duplicado
    if (this.codeSmells.duplicateCode.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'duplication',
        action: 'Eliminar duplicação de código',
        details: `${this.codeSmells.duplicateCode.length} blocos duplicados`,
        effort: 'low'
      });
    }
    
    // Arquivos longos
    if (this.codeSmells.longFile.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'structure',
        action: 'Dividir arquivos grandes',
        details: `${this.codeSmells.longFile.length} arquivos muito longos`,
        effort: 'high'
      });
    }
    
    // Muitos parâmetros
    if (this.codeSmells.tooManyParameters.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'parameters',
        action: 'Reduzir número de parâmetros',
        details: `${this.codeSmells.tooManyParameters.length} funções com muitos parâmetros`,
        effort: 'low'
      });
    }
    
    return recommendations;
  }

  /**
   * Obtém principais problemas
   */
  getTopIssues() {
    const allIssues = [];
    
    Object.entries(this.codeSmells).forEach(([type, smells]) => {
      smells.forEach(smell => {
        allIssues.push({
          type,
          ...smell,
          impact: this.calculateImpact(smell)
        });
      });
    });
    
    // Ordena por impacto (severidade + frequência)
    allIssues.sort((a, b) => b.impact - a.impact);
    
    return allIssues.slice(0, 10); // Top 10
  }

  /**
   * Calcula impacto de um code smell
   */
  calculateImpact(smell) {
    let impact = 0;
    
    switch (smell.severity) {
      case 'high': impact += 10; break;
      case 'medium': impact += 5; break;
      case 'low': impact += 1; break;
    }
    
    // Adiciona peso baseado no tipo
    if (smell.complexity) impact += smell.complexity;
    if (smell.lines) impact += Math.min(smell.lines / 10, 10);
    if (smell.parameters) impact += smell.parameters;
    
    return impact;
  }

  /**
   * Salva relatório em arquivo
   */
  async saveReport(report, outputPath) {
    const reportWithMetadata = {
      metadata: {
        analyzer: 'Code Quality Inspector MCP',
        version: '1.0.0',
        projectRoot: this.projectRoot,
        generatedAt: new Date().toISOString(),
        analysisTime: report.analysisTime
      },
      ...report
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(reportWithMetadata, null, 2));
    console.log(`📊 Relatório salvo em: ${outputPath}`);
  }
}

module.exports = CodeQualityInspector;