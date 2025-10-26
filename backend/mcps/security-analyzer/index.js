const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

/**
 * MCP Security Analyzer
 * Analisa vulnerabilidades de segurança, configurações e secrets no código
 */
class SecurityAnalyzer {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.excludePatterns = options.excludePatterns || [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      'logs'
    ];
    this.secretPatterns = [
      // API Keys
      /(?:api[_-]?key|apikey)[\s]*[:=][\s]*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
      // JWT Secrets
      /(?:jwt[_-]?secret|jwtsecret)[\s]*[:=][\s]*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
      // Database URLs
      /(?:database[_-]?url|db[_-]?url)[\s]*[:=][\s]*['"]?(mongodb|mysql|postgres):\/\/[^\s'"]+['"]?/gi,
      // AWS Keys
      /AKIA[0-9A-Z]{16}/g,
      // Private Keys
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
      // Passwords
      /(?:password|passwd|pwd)[\s]*[:=][\s]*['"]?([^\s'"]{8,})['"]?/gi,
      // Tokens
      /(?:token|access[_-]?token)[\s]*[:=][\s]*['"]?([a-zA-Z0-9_\-\.]{20,})['"]?/gi
    ];
    this.vulnerablePackages = new Set();
    this.securityIssues = [];
  }

  /**
   * Executa análise completa de segurança
   */
  async analyze() {
    console.log('🔍 Iniciando análise de segurança...');
    
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0
      },
      vulnerabilities: [],
      secrets: [],
      headers: [],
      configurations: [],
      recommendations: []
    };

    try {
      // Análise de dependências vulneráveis
      console.log('📦 Analisando dependências...');
      results.vulnerabilities = await this.analyzeDependencies();

      // Análise de secrets no código
      console.log('🔐 Procurando secrets expostos...');
      results.secrets = await this.analyzeSecrets();

      // Análise de headers HTTP
      console.log('🌐 Analisando configurações de headers HTTP...');
      results.headers = await this.analyzeHttpHeaders();

      // Análise de configurações de segurança
      console.log('⚙️ Analisando configurações de segurança...');
      results.configurations = await this.analyzeSecurityConfigurations();

      // Calcular resumo
      this.calculateSummary(results);

      // Gerar recomendações
      results.recommendations = this.generateRecommendations(results);

      console.log('✅ Análise de segurança concluída');
      return results;

    } catch (error) {
      console.error('❌ Erro na análise de segurança:', error);
      throw error;
    }
  }

  /**
   * Analisa dependências vulneráveis usando npm audit
   */
  async analyzeDependencies() {
    const vulnerabilities = [];

    try {
      // Executar npm audit
      const auditResult = execSync('npm audit --json', { 
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities) {
        for (const [packageName, vuln] of Object.entries(audit.vulnerabilities)) {
          vulnerabilities.push({
            type: 'dependency',
            severity: vuln.severity,
            package: packageName,
            title: vuln.title || 'Vulnerabilidade de dependência',
            description: vuln.overview || 'Vulnerabilidade encontrada na dependência',
            recommendation: vuln.recommendation || 'Atualize a dependência para a versão mais recente',
            cwe: vuln.cwe || [],
            cvss: vuln.cvss || null,
            references: vuln.references || []
          });
        }
      }

    } catch (error) {
      // npm audit pode retornar código de saída não-zero mesmo com vulnerabilidades
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          if (audit.vulnerabilities) {
            for (const [packageName, vuln] of Object.entries(audit.vulnerabilities)) {
              vulnerabilities.push({
                type: 'dependency',
                severity: vuln.severity,
                package: packageName,
                title: vuln.title || 'Vulnerabilidade de dependência',
                description: vuln.overview || 'Vulnerabilidade encontrada na dependência',
                recommendation: vuln.recommendation || 'Atualize a dependência para a versão mais recente'
              });
            }
          }
        } catch (parseError) {
          console.warn('⚠️ Não foi possível analisar dependências:', parseError.message);
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Analisa secrets expostos no código
   */
  async analyzeSecrets() {
    const secrets = [];
    const files = this.getAllFiles(this.projectRoot);

    for (const file of files) {
      if (this.shouldSkipFile(file)) continue;

      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          for (const pattern of this.secretPatterns) {
            const matches = line.matchAll(pattern);
            
            for (const match of matches) {
              // Verificar se não é um exemplo ou placeholder
              if (this.isLikelySecret(match[0])) {
                secrets.push({
                  type: 'secret',
                  severity: 'high',
                  file: path.relative(this.projectRoot, file),
                  line: i + 1,
                  content: this.maskSecret(match[0]),
                  pattern: pattern.source,
                  description: 'Secret potencialmente exposto no código',
                  recommendation: 'Mova para variáveis de ambiente ou arquivo de configuração seguro'
                });
              }
            }
          }
        }

      } catch (error) {
        console.warn(`⚠️ Erro ao analisar arquivo ${file}:`, error.message);
      }
    }

    return secrets;
  }

  /**
   * Analisa configurações de headers HTTP
   */
  async analyzeHttpHeaders() {
    const headerIssues = [];
    const appFile = path.join(this.projectRoot, 'app.js');

    if (!fs.existsSync(appFile)) {
      return headerIssues;
    }

    try {
      const content = fs.readFileSync(appFile, 'utf8');

      // Verificar se helmet está sendo usado
      if (!content.includes('helmet')) {
        headerIssues.push({
          type: 'header',
          severity: 'medium',
          issue: 'helmet_missing',
          description: 'Middleware Helmet não encontrado',
          recommendation: 'Adicione o middleware Helmet para configurar headers de segurança automaticamente',
          file: 'app.js'
        });
      }

      // Verificar headers específicos
      const securityHeaders = [
        {
          name: 'X-Content-Type-Options',
          pattern: /X-Content-Type-Options/i,
          description: 'Header X-Content-Type-Options não configurado',
          recommendation: 'Configure X-Content-Type-Options: nosniff'
        },
        {
          name: 'X-Frame-Options',
          pattern: /X-Frame-Options/i,
          description: 'Header X-Frame-Options não configurado',
          recommendation: 'Configure X-Frame-Options: DENY ou SAMEORIGIN'
        },
        {
          name: 'X-XSS-Protection',
          pattern: /X-XSS-Protection/i,
          description: 'Header X-XSS-Protection não configurado',
          recommendation: 'Configure X-XSS-Protection: 1; mode=block'
        },
        {
          name: 'Strict-Transport-Security',
          pattern: /Strict-Transport-Security/i,
          description: 'Header HSTS não configurado',
          recommendation: 'Configure Strict-Transport-Security para HTTPS'
        }
      ];

      for (const header of securityHeaders) {
        if (!header.pattern.test(content)) {
          headerIssues.push({
            type: 'header',
            severity: 'medium',
            issue: `missing_${header.name.toLowerCase().replace(/-/g, '_')}`,
            description: header.description,
            recommendation: header.recommendation,
            file: 'app.js'
          });
        }
      }

    } catch (error) {
      console.warn('⚠️ Erro ao analisar headers HTTP:', error.message);
    }

    return headerIssues;
  }

  /**
   * Analisa configurações de segurança
   */
  async analyzeSecurityConfigurations() {
    const configIssues = [];

    // Verificar arquivo .env
    const envFile = path.join(this.projectRoot, '.env');
    if (fs.existsSync(envFile)) {
      try {
        const envContent = fs.readFileSync(envFile, 'utf8');
        
        // Verificar se NODE_ENV está definido
        if (!envContent.includes('NODE_ENV')) {
          configIssues.push({
            type: 'configuration',
            severity: 'medium',
            issue: 'node_env_missing',
            description: 'NODE_ENV não definido no arquivo .env',
            recommendation: 'Defina NODE_ENV=production para ambiente de produção',
            file: '.env'
          });
        }

        // Verificar se há secrets no .env (que deveria estar no .gitignore)
        for (const pattern of this.secretPatterns) {
          if (pattern.test(envContent)) {
            configIssues.push({
              type: 'configuration',
              severity: 'low',
              issue: 'env_file_exists',
              description: 'Arquivo .env contém configurações sensíveis',
              recommendation: 'Certifique-se de que .env está no .gitignore',
              file: '.env'
            });
            break;
          }
        }

      } catch (error) {
        console.warn('⚠️ Erro ao analisar arquivo .env:', error.message);
      }
    }

    // Verificar .gitignore
    const gitignoreFile = path.join(this.projectRoot, '.gitignore');
    if (fs.existsSync(gitignoreFile)) {
      try {
        const gitignoreContent = fs.readFileSync(gitignoreFile, 'utf8');
        
        const importantIgnores = ['.env', 'node_modules', 'logs', '*.log'];
        for (const ignore of importantIgnores) {
          if (!gitignoreContent.includes(ignore)) {
            configIssues.push({
              type: 'configuration',
              severity: 'medium',
              issue: 'gitignore_incomplete',
              description: `${ignore} não está no .gitignore`,
              recommendation: `Adicione ${ignore} ao .gitignore`,
              file: '.gitignore'
            });
          }
        }

      } catch (error) {
        console.warn('⚠️ Erro ao analisar .gitignore:', error.message);
      }
    } else {
      configIssues.push({
        type: 'configuration',
        severity: 'high',
        issue: 'gitignore_missing',
        description: 'Arquivo .gitignore não encontrado',
        recommendation: 'Crie um arquivo .gitignore para proteger arquivos sensíveis',
        file: 'root'
      });
    }

    // Verificar package.json para configurações de segurança
    const packageFile = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageFile)) {
      try {
        const packageContent = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
        
        // Verificar se há scripts de segurança
        if (!packageContent.scripts || !packageContent.scripts.audit) {
          configIssues.push({
            type: 'configuration',
            severity: 'low',
            issue: 'no_audit_script',
            description: 'Script de auditoria de segurança não configurado',
            recommendation: 'Adicione script "audit": "npm audit" ao package.json',
            file: 'package.json'
          });
        }

      } catch (error) {
        console.warn('⚠️ Erro ao analisar package.json:', error.message);
      }
    }

    return configIssues;
  }

  /**
   * Calcula resumo das issues encontradas
   */
  calculateSummary(results) {
    const allIssues = [
      ...results.vulnerabilities,
      ...results.secrets,
      ...results.headers,
      ...results.configurations
    ];

    results.summary.totalIssues = allIssues.length;

    for (const issue of allIssues) {
      switch (issue.severity) {
        case 'critical':
          results.summary.criticalIssues++;
          break;
        case 'high':
          results.summary.highIssues++;
          break;
        case 'medium':
          results.summary.mediumIssues++;
          break;
        case 'low':
          results.summary.lowIssues++;
          break;
      }
    }
  }

  /**
   * Gera recomendações baseadas nos problemas encontrados
   */
  generateRecommendations(results) {
    const recommendations = [];

    if (results.summary.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Corrija imediatamente todas as vulnerabilidades críticas',
        description: 'Vulnerabilidades críticas podem comprometer completamente a segurança do sistema'
      });
    }

    if (results.secrets.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Remova todos os secrets expostos do código',
        description: 'Mova secrets para variáveis de ambiente ou sistemas de gerenciamento de secrets'
      });
    }

    if (results.headers.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Configure headers de segurança HTTP',
        description: 'Use o middleware Helmet para configurar automaticamente headers de segurança'
      });
    }

    if (results.vulnerabilities.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Atualize dependências vulneráveis',
        description: 'Execute npm audit fix para corrigir vulnerabilidades automaticamente'
      });
    }

    return recommendations;
  }

  /**
   * Obtém todos os arquivos do projeto
   */
  getAllFiles(dir) {
    const files = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !this.shouldSkipDirectory(item)) {
          files.push(...this.getAllFiles(fullPath));
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao ler diretório ${dir}:`, error.message);
    }
    
    return files;
  }

  /**
   * Verifica se deve pular o diretório
   */
  shouldSkipDirectory(dirname) {
    return this.excludePatterns.some(pattern => dirname.includes(pattern));
  }

  /**
   * Verifica se deve pular o arquivo
   */
  shouldSkipFile(filepath) {
    const ext = path.extname(filepath);
    const allowedExtensions = ['.js', '.ts', '.json', '.env', '.md', '.yml', '.yaml'];
    
    return !allowedExtensions.includes(ext) || 
           this.excludePatterns.some(pattern => filepath.includes(pattern));
  }

  /**
   * Verifica se é provavelmente um secret real
   */
  isLikelySecret(text) {
    const placeholders = [
      'your-api-key',
      'your-secret',
      'example',
      'test',
      'demo',
      'placeholder',
      'xxx',
      '***',
      'changeme',
      'replace-me'
    ];

    const lowerText = text.toLowerCase();
    return !placeholders.some(placeholder => lowerText.includes(placeholder));
  }

  /**
   * Mascara secret para exibição
   */
  maskSecret(secret) {
    if (secret.length <= 8) {
      return '*'.repeat(secret.length);
    }
    
    const start = secret.substring(0, 4);
    const end = secret.substring(secret.length - 4);
    const middle = '*'.repeat(secret.length - 8);
    
    return start + middle + end;
  }

  /**
   * Salva relatório em arquivo
   */
  async saveReport(results, outputPath) {
    const report = {
      ...results,
      metadata: {
        analyzer: 'Security Analyzer MCP',
        version: '1.0.0',
        projectRoot: this.projectRoot,
        generatedAt: new Date().toISOString()
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Relatório salvo em: ${outputPath}`);
  }
}

module.exports = SecurityAnalyzer;