const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * MCP Dependency Auditor
 * Analisa dependências desatualizadas, licenças, dependências não utilizadas
 * e árvore de dependências
 */
class DependencyAuditor {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.packageJsonPath = path.join(projectRoot, 'package.json');
    this.packageLockPath = path.join(projectRoot, 'package-lock.json');
  }

  /**
   * Executa análise completa de dependências
   */
  async analyze() {
    try {
      const results = {
        outdated: await this.analyzeOutdatedDependencies(),
        licenses: await this.analyzeLicenses(),
        unused: await this.analyzeUnusedDependencies(),
        tree: await this.analyzeDependencyTree(),
        security: await this.analyzeSecurityIssues(),
        summary: {}
      };

      results.summary = this.calculateSummary(results);
      
      await this.saveReport(results);
      return results;
    } catch (error) {
      console.error('Erro durante análise de dependências:', error);
      throw error;
    }
  }

  /**
   * Analisa dependências desatualizadas
   */
  async analyzeOutdatedDependencies() {
    const issues = [];

    try {
      if (!fs.existsSync(this.packageJsonPath)) {
        return issues;
      }

      // Executa npm outdated para verificar dependências desatualizadas
      const outdatedOutput = execSync('npm outdated --json', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      const outdatedData = JSON.parse(outdatedOutput);

      Object.entries(outdatedData).forEach(([packageName, info]) => {
        issues.push({
          type: 'outdated',
          severity: this.getOutdatedSeverity(info.current, info.latest),
          package: packageName,
          currentVersion: info.current,
          latestVersion: info.latest,
          wantedVersion: info.wanted,
          location: info.location || 'dependencies',
          description: `Dependência ${packageName} está desatualizada`,
          recommendation: `Atualizar de ${info.current} para ${info.latest}`
        });
      });

    } catch (error) {
      // npm outdated retorna exit code 1 quando há dependências desatualizadas
      if (error.stdout) {
        try {
          const outdatedData = JSON.parse(error.stdout);
          Object.entries(outdatedData).forEach(([packageName, info]) => {
            issues.push({
              type: 'outdated',
              severity: this.getOutdatedSeverity(info.current, info.latest),
              package: packageName,
              currentVersion: info.current,
              latestVersion: info.latest,
              wantedVersion: info.wanted,
              location: info.location || 'dependencies',
              description: `Dependência ${packageName} está desatualizada`,
              recommendation: `Atualizar de ${info.current} para ${info.latest}`
            });
          });
        } catch (parseError) {
          console.warn('Erro ao analisar dependências desatualizadas:', parseError);
        }
      }
    }

    return issues;
  }

  /**
   * Analisa licenças das dependências
   */
  async analyzeLicenses() {
    const issues = [];

    try {
      if (!fs.existsSync(this.packageJsonPath)) {
        return issues;
      }

      // Lista de licenças problemáticas
      const problematicLicenses = [
        'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0',
        'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0',
        'UNLICENSED', 'UNKNOWN'
      ];

      // Executa npm ls para obter informações das dependências
      const lsOutput = execSync('npm ls --json --all', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      const dependencyTree = JSON.parse(lsOutput);
      this.analyzeLicensesRecursive(dependencyTree, issues, problematicLicenses);

    } catch (error) {
      console.warn('Erro ao analisar licenças:', error.message);
    }

    return issues;
  }

  /**
   * Analisa dependências não utilizadas
   */
  async analyzeUnusedDependencies() {
    const issues = [];

    try {
      if (!fs.existsSync(this.packageJsonPath)) {
        return issues;
      }

      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      const dependencies = {
        ...packageJson.dependencies || {},
        ...packageJson.devDependencies || {}
      };

      // Obtém todos os arquivos JavaScript/TypeScript do projeto
      const sourceFiles = this.getAllSourceFiles();
      const usedDependencies = new Set();

      // Analisa imports/requires em todos os arquivos
      sourceFiles.forEach(filePath => {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Regex para capturar imports e requires
          const importRegex = /(?:import.*from\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\))/g;
          let match;

          while ((match = importRegex.exec(content)) !== null) {
            const moduleName = match[1] || match[2];
            if (moduleName && !moduleName.startsWith('.') && !moduleName.startsWith('/')) {
              // Extrai o nome do pacote (remove subpaths)
              const packageName = moduleName.split('/')[0];
              if (packageName.startsWith('@')) {
                // Scoped packages
                const scopedName = moduleName.split('/').slice(0, 2).join('/');
                usedDependencies.add(scopedName);
              } else {
                usedDependencies.add(packageName);
              }
            }
          }
        } catch (error) {
          console.warn(`Erro ao analisar arquivo ${filePath}:`, error.message);
        }
      });

      // Identifica dependências não utilizadas
      Object.keys(dependencies).forEach(packageName => {
        if (!usedDependencies.has(packageName)) {
          issues.push({
            type: 'unused',
            severity: 'low',
            package: packageName,
            version: dependencies[packageName],
            description: `Dependência ${packageName} não está sendo utilizada`,
            recommendation: `Remover dependência não utilizada: npm uninstall ${packageName}`
          });
        }
      });

    } catch (error) {
      console.warn('Erro ao analisar dependências não utilizadas:', error.message);
    }

    return issues;
  }

  /**
   * Analisa árvore de dependências
   */
  async analyzeDependencyTree() {
    const issues = [];

    try {
      if (!fs.existsSync(this.packageJsonPath)) {
        return issues;
      }

      // Executa npm ls para obter a árvore de dependências
      const lsOutput = execSync('npm ls --json --all', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      const dependencyTree = JSON.parse(lsOutput);
      
      // Analisa conflitos de versão e dependências duplicadas
      this.analyzeDependencyConflicts(dependencyTree, issues);
      this.analyzeDuplicateDependencies(dependencyTree, issues);

    } catch (error) {
      console.warn('Erro ao analisar árvore de dependências:', error.message);
    }

    return issues;
  }

  /**
   * Analisa problemas de segurança nas dependências
   */
  async analyzeSecurityIssues() {
    const issues = [];

    try {
      // Executa npm audit para verificar vulnerabilidades
      const auditOutput = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      const auditData = JSON.parse(auditOutput);

      if (auditData.vulnerabilities) {
        Object.entries(auditData.vulnerabilities).forEach(([packageName, vuln]) => {
          issues.push({
            type: 'security',
            severity: vuln.severity || 'medium',
            package: packageName,
            title: vuln.title,
            description: vuln.overview || `Vulnerabilidade de segurança em ${packageName}`,
            recommendation: vuln.recommendation || 'Atualizar para versão segura',
            cwe: vuln.cwe,
            cvss: vuln.cvss
          });
        });
      }

    } catch (error) {
      // npm audit pode retornar exit code diferente de 0 quando há vulnerabilidades
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          if (auditData.vulnerabilities) {
            Object.entries(auditData.vulnerabilities).forEach(([packageName, vuln]) => {
              issues.push({
                type: 'security',
                severity: vuln.severity || 'medium',
                package: packageName,
                title: vuln.title,
                description: vuln.overview || `Vulnerabilidade de segurança em ${packageName}`,
                recommendation: vuln.recommendation || 'Atualizar para versão segura'
              });
            });
          }
        } catch (parseError) {
          console.warn('Erro ao analisar audit de segurança:', parseError);
        }
      }
    }

    return issues;
  }

  /**
   * Determina severidade baseada na diferença de versões
   */
  getOutdatedSeverity(current, latest) {
    try {
      const currentParts = current.split('.').map(Number);
      const latestParts = latest.split('.').map(Number);

      // Major version difference
      if (latestParts[0] > currentParts[0]) {
        return 'high';
      }
      // Minor version difference
      if (latestParts[1] > currentParts[1]) {
        return 'medium';
      }
      // Patch version difference
      return 'low';
    } catch (error) {
      return 'medium';
    }
  }

  /**
   * Analisa licenças recursivamente na árvore de dependências
   */
  analyzeLicensesRecursive(node, issues, problematicLicenses, path = []) {
    if (node.dependencies) {
      Object.entries(node.dependencies).forEach(([name, info]) => {
        const currentPath = [...path, name];
        
        if (info.license && problematicLicenses.includes(info.license)) {
          issues.push({
            type: 'license',
            severity: 'medium',
            package: name,
            version: info.version,
            license: info.license,
            path: currentPath.join(' > '),
            description: `Licença problemática: ${info.license}`,
            recommendation: 'Verificar compatibilidade da licença com o projeto'
          });
        }

        // Recursão para dependências aninhadas
        this.analyzeLicensesRecursive(info, issues, problematicLicenses, currentPath);
      });
    }
  }

  /**
   * Obtém todos os arquivos fonte do projeto
   */
  getAllSourceFiles() {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    const scanDirectory = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory() && !excludeDirs.includes(item)) {
            scanDirectory(fullPath);
          } else if (stat.isFile() && extensions.includes(path.extname(item))) {
            files.push(fullPath);
          }
        });
      } catch (error) {
        // Ignora erros de permissão
      }
    };

    scanDirectory(this.projectRoot);
    return files;
  }

  /**
   * Analisa conflitos de versão
   */
  analyzeDependencyConflicts(tree, issues) {
    const versionMap = new Map();

    const collectVersions = (node, path = []) => {
      if (node.dependencies) {
        Object.entries(node.dependencies).forEach(([name, info]) => {
          if (!versionMap.has(name)) {
            versionMap.set(name, new Set());
          }
          versionMap.get(name).add(info.version);

          collectVersions(info, [...path, name]);
        });
      }
    };

    collectVersions(tree);

    versionMap.forEach((versions, packageName) => {
      if (versions.size > 1) {
        issues.push({
          type: 'conflict',
          severity: 'medium',
          package: packageName,
          versions: Array.from(versions),
          description: `Múltiplas versões de ${packageName} detectadas`,
          recommendation: 'Resolver conflitos de versão para evitar problemas'
        });
      }
    });
  }

  /**
   * Analisa dependências duplicadas
   */
  analyzeDuplicateDependencies(tree, issues) {
    const packageCounts = new Map();

    const countPackages = (node) => {
      if (node.dependencies) {
        Object.entries(node.dependencies).forEach(([name, info]) => {
          packageCounts.set(name, (packageCounts.get(name) || 0) + 1);
          countPackages(info);
        });
      }
    };

    countPackages(tree);

    packageCounts.forEach((count, packageName) => {
      if (count > 3) { // Threshold para considerar como duplicação excessiva
        issues.push({
          type: 'duplicate',
          severity: 'low',
          package: packageName,
          count: count,
          description: `Dependência ${packageName} aparece ${count} vezes na árvore`,
          recommendation: 'Considerar dedupe: npm dedupe'
        });
      }
    });
  }

  /**
   * Calcula resumo da análise
   */
  calculateSummary(results) {
    const allIssues = [
      ...results.outdated,
      ...results.licenses,
      ...results.unused,
      ...results.tree,
      ...results.security
    ];

    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const typeCounts = {
      outdated: results.outdated.length,
      licenses: results.licenses.length,
      unused: results.unused.length,
      tree: results.tree.length,
      security: results.security.length
    };

    allIssues.forEach(issue => {
      severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
    });

    return {
      totalIssues: allIssues.length,
      severityCounts,
      typeCounts,
      riskScore: this.calculateRiskScore(severityCounts)
    };
  }

  /**
   * Calcula score de risco
   */
  calculateRiskScore(severityCounts) {
    const weights = { critical: 10, high: 5, medium: 2, low: 1 };
    return Object.entries(severityCounts).reduce((score, [severity, count]) => {
      return score + (count * (weights[severity] || 0));
    }, 0);
  }

  /**
   * Gera recomendações baseadas nos resultados
   */
  generateRecommendations(results) {
    const recommendations = [];

    if (results.outdated.length > 0) {
      recommendations.push({
        category: 'Atualizações',
        priority: 'high',
        action: 'Atualizar dependências desatualizadas',
        command: 'npm update'
      });
    }

    if (results.unused.length > 0) {
      recommendations.push({
        category: 'Limpeza',
        priority: 'medium',
        action: 'Remover dependências não utilizadas',
        packages: results.unused.map(u => u.package)
      });
    }

    if (results.security.length > 0) {
      recommendations.push({
        category: 'Segurança',
        priority: 'critical',
        action: 'Corrigir vulnerabilidades de segurança',
        command: 'npm audit fix'
      });
    }

    return recommendations;
  }

  /**
   * Salva relatório em arquivo
   */
  async saveReport(results) {
    try {
      const reportPath = path.join(this.projectRoot, 'dependency-audit-report.json');
      const report = {
        timestamp: new Date().toISOString(),
        projectRoot: this.projectRoot,
        results,
        recommendations: this.generateRecommendations(results)
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Relatório de auditoria de dependências salvo em: ${reportPath}`);
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
    }
  }
}

module.exports = DependencyAuditor;