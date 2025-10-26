const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * MCP Test Coverage Analyzer
 * Analisa cobertura de testes, identifica código não testado,
 * métricas de qualidade de testes e sugestões de testes faltantes
 */
class TestCoverageAnalyzer {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.coverageDir = path.join(projectRoot, 'coverage');
    this.testDir = path.join(projectRoot, 'tests');
    this.srcDir = path.join(projectRoot, 'src');
    this.packageJsonPath = path.join(projectRoot, 'package.json');
    this.jestConfigPath = path.join(projectRoot, 'jest.config.js');
  }

  /**
   * Executa análise completa de cobertura de testes
   */
  async analyze() {
    try {
      const results = {
        coverage: await this.analyzeCoverage(),
        testQuality: await this.analyzeTestQuality(),
        missingTests: await this.identifyMissingTests(),
        testStructure: await this.analyzeTestStructure(),
        recommendations: [],
        summary: {}
      };

      results.recommendations = this.generateRecommendations(results);
      results.summary = this.calculateSummary(results);
      
      await this.saveReport(results);
      return results;
    } catch (error) {
      console.error('Erro durante análise de cobertura:', error);
      throw error;
    }
  }

  /**
   * Analisa cobertura de código
   */
  async analyzeCoverage() {
    const issues = [];

    try {
      // Verifica se Jest está configurado
      if (!this.isJestConfigured()) {
        issues.push({
          type: 'coverage',
          severity: 'high',
          issue: 'jest_not_configured',
          description: 'Jest não está configurado para cobertura',
          recommendation: 'Configurar Jest com collectCoverage: true'
        });
        return issues;
      }

      // Executa testes com cobertura
      const coverageData = await this.runCoverageAnalysis();
      
      if (!coverageData) {
        issues.push({
          type: 'coverage',
          severity: 'high',
          issue: 'coverage_data_unavailable',
          description: 'Dados de cobertura não disponíveis',
          recommendation: 'Executar npm test -- --coverage para gerar dados'
        });
        return issues;
      }

      // Analisa métricas de cobertura
      this.analyzeCoverageMetrics(coverageData, issues);
      
      // Analisa arquivos não cobertos
      this.analyzeUncoveredFiles(coverageData, issues);
      
      // Analisa linhas não cobertas
      this.analyzeUncoveredLines(coverageData, issues);

    } catch (error) {
      issues.push({
        type: 'coverage',
        severity: 'high',
        issue: 'coverage_analysis_error',
        description: `Erro ao analisar cobertura: ${error.message}`,
        recommendation: 'Verificar configuração de testes e cobertura'
      });
    }

    return issues;
  }

  /**
   * Analisa qualidade dos testes
   */
  async analyzeTestQuality() {
    const issues = [];

    try {
      // Verifica estrutura de testes
      this.analyzeTestFileStructure(issues);
      
      // Analisa padrões de teste
      this.analyzeTestPatterns(issues);
      
      // Verifica mocks e stubs
      this.analyzeMocksAndStubs(issues);
      
      // Analisa assertions
      this.analyzeAssertions(issues);
      
      // Verifica testes de integração
      this.analyzeIntegrationTests(issues);

    } catch (error) {
      issues.push({
        type: 'test_quality',
        severity: 'medium',
        issue: 'test_quality_analysis_error',
        description: `Erro ao analisar qualidade dos testes: ${error.message}`,
        recommendation: 'Verificar estrutura e conteúdo dos arquivos de teste'
      });
    }

    return issues;
  }

  /**
   * Identifica testes faltantes
   */
  async identifyMissingTests() {
    const issues = [];

    try {
      // Identifica arquivos sem testes
      const sourceFiles = this.getSourceFiles();
      const testFiles = this.getTestFiles();
      
      this.findFilesWithoutTests(sourceFiles, testFiles, issues);
      
      // Identifica funções sem testes
      this.findFunctionsWithoutTests(sourceFiles, testFiles, issues);
      
      // Identifica cenários de teste faltantes
      this.findMissingTestScenarios(issues);
      
      // Verifica testes E2E
      this.analyzeE2ETests(issues);

    } catch (error) {
      issues.push({
        type: 'missing_tests',
        severity: 'medium',
        issue: 'missing_tests_analysis_error',
        description: `Erro ao identificar testes faltantes: ${error.message}`,
        recommendation: 'Verificar estrutura de arquivos de código e teste'
      });
    }

    return issues;
  }

  /**
   * Analisa estrutura de testes
   */
  async analyzeTestStructure() {
    const issues = [];

    try {
      // Verifica organização de diretórios
      this.analyzeTestDirectoryStructure(issues);
      
      // Verifica convenções de nomenclatura
      this.analyzeTestNamingConventions(issues);
      
      // Analisa configuração de setup/teardown
      this.analyzeTestSetupTeardown(issues);
      
      // Verifica helpers e utilities
      this.analyzeTestHelpers(issues);

    } catch (error) {
      issues.push({
        type: 'test_structure',
        severity: 'low',
        issue: 'test_structure_analysis_error',
        description: `Erro ao analisar estrutura de testes: ${error.message}`,
        recommendation: 'Verificar organização dos arquivos de teste'
      });
    }

    return issues;
  }

  /**
   * Verifica se Jest está configurado
   */
  isJestConfigured() {
    try {
      if (fs.existsSync(this.jestConfigPath)) {
        return true;
      }

      if (fs.existsSync(this.packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
        return packageJson.jest || 
               (packageJson.scripts && packageJson.scripts.test) ||
               (packageJson.devDependencies && packageJson.devDependencies.jest);
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Executa análise de cobertura
   */
  async runCoverageAnalysis() {
    try {
      // Verifica se existe relatório de cobertura recente
      const coverageJsonPath = path.join(this.coverageDir, 'coverage-final.json');
      
      if (fs.existsSync(coverageJsonPath)) {
        const stats = fs.statSync(coverageJsonPath);
        const isRecent = (Date.now() - stats.mtime.getTime()) < 3600000; // 1 hora
        
        if (isRecent) {
          return JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));
        }
      }

      // Tenta executar testes com cobertura
      try {
        execSync('npm test -- --coverage --silent', { 
          cwd: this.projectRoot,
          stdio: 'pipe'
        });
        
        if (fs.existsSync(coverageJsonPath)) {
          return JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));
        }
      } catch (execError) {
        console.warn('Não foi possível executar testes com cobertura:', execError.message);
      }

      return null;
    } catch (error) {
      console.warn('Erro ao obter dados de cobertura:', error.message);
      return null;
    }
  }

  /**
   * Analisa métricas de cobertura
   */
  analyzeCoverageMetrics(coverageData, issues) {
    const thresholds = {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    };

    Object.entries(coverageData).forEach(([filePath, fileData]) => {
      if (!fileData.s || !fileData.b || !fileData.f) return;

      const metrics = this.calculateFileMetrics(fileData);
      
      Object.entries(thresholds).forEach(([metric, threshold]) => {
        if (metrics[metric] < threshold) {
          issues.push({
            type: 'coverage',
            severity: metrics[metric] < threshold * 0.5 ? 'high' : 'medium',
            issue: 'low_coverage',
            file: filePath,
            metric: metric,
            current: metrics[metric],
            threshold: threshold,
            description: `Baixa cobertura de ${metric} em ${filePath}: ${metrics[metric]}%`,
            recommendation: `Aumentar cobertura de ${metric} para pelo menos ${threshold}%`
          });
        }
      });
    });
  }

  /**
   * Calcula métricas de um arquivo
   */
  calculateFileMetrics(fileData) {
    const statements = Object.values(fileData.s);
    const branches = Object.values(fileData.b).flat();
    const functions = Object.values(fileData.f);

    return {
      statements: this.calculateCoveragePercentage(statements),
      branches: this.calculateCoveragePercentage(branches),
      functions: this.calculateCoveragePercentage(functions),
      lines: this.calculateCoveragePercentage(statements) // Simplificação
    };
  }

  /**
   * Calcula porcentagem de cobertura
   */
  calculateCoveragePercentage(data) {
    if (data.length === 0) return 100;
    
    const covered = data.filter(count => count > 0).length;
    return Math.round((covered / data.length) * 100);
  }

  /**
   * Analisa arquivos não cobertos
   */
  analyzeUncoveredFiles(coverageData, issues) {
    const sourceFiles = this.getSourceFiles();
    const coveredFiles = Object.keys(coverageData);
    
    const uncoveredFiles = sourceFiles.filter(file => 
      !coveredFiles.some(covered => covered.includes(file))
    );

    uncoveredFiles.forEach(file => {
      issues.push({
        type: 'coverage',
        severity: 'medium',
        issue: 'file_not_covered',
        file: file,
        description: `Arquivo ${file} não possui cobertura de testes`,
        recommendation: 'Criar testes para este arquivo'
      });
    });
  }

  /**
   * Analisa linhas não cobertas
   */
  analyzeUncoveredLines(coverageData, issues) {
    Object.entries(coverageData).forEach(([filePath, fileData]) => {
      if (!fileData.statementMap || !fileData.s) return;

      const uncoveredStatements = Object.entries(fileData.s)
        .filter(([, count]) => count === 0)
        .map(([statementId]) => fileData.statementMap[statementId]);

      if (uncoveredStatements.length > 0) {
        const uncoveredLines = uncoveredStatements.map(stmt => stmt.start.line);
        
        issues.push({
          type: 'coverage',
          severity: 'low',
          issue: 'uncovered_lines',
          file: filePath,
          lines: uncoveredLines,
          count: uncoveredLines.length,
          description: `${uncoveredLines.length} linhas não cobertas em ${filePath}`,
          recommendation: 'Adicionar testes para cobrir essas linhas'
        });
      }
    });
  }

  /**
   * Analisa estrutura de arquivos de teste
   */
  analyzeTestFileStructure(issues) {
    if (!fs.existsSync(this.testDir)) {
      issues.push({
        type: 'test_quality',
        severity: 'high',
        issue: 'no_test_directory',
        description: 'Diretório de testes não encontrado',
        recommendation: 'Criar estrutura de diretórios para testes'
      });
      return;
    }

    // Verifica estrutura recomendada
    const recommendedDirs = ['unit', 'integration', 'e2e', 'fixtures', 'helpers'];
    
    recommendedDirs.forEach(dir => {
      const dirPath = path.join(this.testDir, dir);
      if (!fs.existsSync(dirPath)) {
        issues.push({
          type: 'test_quality',
          severity: 'medium',
          issue: 'missing_test_directory',
          directory: dir,
          description: `Diretório ${dir} não encontrado em tests/`,
          recommendation: `Criar diretório tests/${dir} para organização`
        });
      }
    });
  }

  /**
   * Analisa padrões de teste
   */
  analyzeTestPatterns(issues) {
    const testFiles = this.getTestFiles();
    
    testFiles.forEach(testFile => {
      try {
        const content = fs.readFileSync(testFile, 'utf8');
        
        // Verifica padrões AAA (Arrange, Act, Assert)
        this.checkAAAPattern(content, testFile, issues);
        
        // Verifica uso de describe/it
        this.checkDescribeItPattern(content, testFile, issues);
        
        // Verifica setup/teardown
        this.checkSetupTeardownPattern(content, testFile, issues);
        
      } catch (error) {
        issues.push({
          type: 'test_quality',
          severity: 'low',
          issue: 'test_file_read_error',
          file: testFile,
          description: `Erro ao ler arquivo de teste: ${error.message}`,
          recommendation: 'Verificar permissões e integridade do arquivo'
        });
      }
    });
  }

  /**
   * Verifica padrão AAA nos testes
   */
  checkAAAPattern(content, testFile, issues) {
    const itBlocks = content.match(/it\(['"`].*?['"`],.*?\{[\s\S]*?\}\);/g) || [];
    
    itBlocks.forEach((block, index) => {
      const hasArrange = /\/\/\s*arrange|\/\*\s*arrange/i.test(block);
      const hasAct = /\/\/\s*act|\/\*\s*act/i.test(block);
      const hasAssert = /expect\(|assert\(/.test(block);
      
      if (!hasAssert) {
        issues.push({
          type: 'test_quality',
          severity: 'medium',
          issue: 'missing_assertions',
          file: testFile,
          test: index + 1,
          description: `Teste ${index + 1} em ${testFile} não possui assertions`,
          recommendation: 'Adicionar assertions para validar o comportamento'
        });
      }
      
      if (block.length > 500 && (!hasArrange || !hasAct)) {
        issues.push({
          type: 'test_quality',
          severity: 'low',
          issue: 'unclear_test_structure',
          file: testFile,
          test: index + 1,
          description: `Teste ${index + 1} em ${testFile} pode se beneficiar do padrão AAA`,
          recommendation: 'Organizar teste com comentários Arrange, Act, Assert'
        });
      }
    });
  }

  /**
   * Verifica padrão describe/it
   */
  checkDescribeItPattern(content, testFile, issues) {
    const hasDescribe = /describe\(['"`]/.test(content);
    const hasIt = /it\(['"`]/.test(content);
    
    if (!hasDescribe && hasIt) {
      issues.push({
        type: 'test_quality',
        severity: 'low',
        issue: 'missing_describe_blocks',
        file: testFile,
        description: `Arquivo ${testFile} não usa blocos describe para organização`,
        recommendation: 'Usar describe() para agrupar testes relacionados'
      });
    }
    
    if (hasDescribe && !hasIt) {
      issues.push({
        type: 'test_quality',
        severity: 'medium',
        issue: 'describe_without_tests',
        file: testFile,
        description: `Arquivo ${testFile} tem describe() mas não tem testes it()`,
        recommendation: 'Adicionar testes it() dentro dos blocos describe()'
      });
    }
  }

  /**
   * Verifica setup/teardown
   */
  checkSetupTeardownPattern(content, testFile, issues) {
    const hasBeforeEach = /beforeEach\(/.test(content);
    const hasAfterEach = /afterEach\(/.test(content);
    const hasMocks = /sinon|jest\.mock|jest\.fn/.test(content);
    
    if (hasMocks && !hasAfterEach) {
      issues.push({
        type: 'test_quality',
        severity: 'medium',
        issue: 'missing_cleanup',
        file: testFile,
        description: `Arquivo ${testFile} usa mocks mas não tem cleanup`,
        recommendation: 'Adicionar afterEach() para limpar mocks e stubs'
      });
    }
  }

  /**
   * Analisa mocks e stubs
   */
  analyzeMocksAndStubs(issues) {
    const testFiles = this.getTestFiles();
    
    testFiles.forEach(testFile => {
      try {
        const content = fs.readFileSync(testFile, 'utf8');
        
        // Verifica uso excessivo de mocks
        const mockCount = (content.match(/jest\.mock|sinon\.stub|sinon\.mock/g) || []).length;
        const testCount = (content.match(/it\(['"`]/g) || []).length;
        
        if (mockCount > testCount * 2) {
          issues.push({
            type: 'test_quality',
            severity: 'medium',
            issue: 'excessive_mocking',
            file: testFile,
            mockCount: mockCount,
            testCount: testCount,
            description: `Arquivo ${testFile} tem muitos mocks (${mockCount}) para poucos testes (${testCount})`,
            recommendation: 'Considerar refatorar testes para reduzir dependência de mocks'
          });
        }
        
        // Verifica mocks não restaurados
        const hasMocks = /jest\.mock|sinon\.stub/.test(content);
        const hasRestore = /restore\(\)|restoreAllMocks/.test(content);
        
        if (hasMocks && !hasRestore) {
          issues.push({
            type: 'test_quality',
            severity: 'medium',
            issue: 'mocks_not_restored',
            file: testFile,
            description: `Arquivo ${testFile} usa mocks mas não os restaura`,
            recommendation: 'Adicionar restore() ou usar afterEach para limpar mocks'
          });
        }
        
      } catch (error) {
        // Ignora erros de leitura
      }
    });
  }

  /**
   * Analisa assertions
   */
  analyzeAssertions(issues) {
    const testFiles = this.getTestFiles();
    
    testFiles.forEach(testFile => {
      try {
        const content = fs.readFileSync(testFile, 'utf8');
        
        // Verifica tipos de assertions
        const expectCount = (content.match(/expect\(/g) || []).length;
        const assertCount = (content.match(/assert\(/g) || []).length;
        const testCount = (content.match(/it\(['"`]/g) || []).length;
        
        const totalAssertions = expectCount + assertCount;
        
        if (testCount > 0 && totalAssertions === 0) {
          issues.push({
            type: 'test_quality',
            severity: 'high',
            issue: 'no_assertions',
            file: testFile,
            description: `Arquivo ${testFile} tem testes mas nenhuma assertion`,
            recommendation: 'Adicionar assertions para validar comportamento esperado'
          });
        }
        
        if (testCount > 0 && totalAssertions / testCount < 1) {
          issues.push({
            type: 'test_quality',
            severity: 'medium',
            issue: 'few_assertions',
            file: testFile,
            assertionRatio: totalAssertions / testCount,
            description: `Arquivo ${testFile} tem poucos assertions por teste`,
            recommendation: 'Considerar adicionar mais assertions para validação completa'
          });
        }
        
      } catch (error) {
        // Ignora erros de leitura
      }
    });
  }

  /**
   * Analisa testes de integração
   */
  analyzeIntegrationTests(issues) {
    const integrationDir = path.join(this.testDir, 'integration');
    
    if (!fs.existsSync(integrationDir)) {
      issues.push({
        type: 'test_quality',
        severity: 'medium',
        issue: 'no_integration_tests',
        description: 'Nenhum teste de integração encontrado',
        recommendation: 'Criar testes de integração para APIs e fluxos completos'
      });
      return;
    }
    
    try {
      const integrationFiles = fs.readdirSync(integrationDir)
        .filter(file => file.endsWith('.test.js') || file.endsWith('.spec.js'));
      
      if (integrationFiles.length === 0) {
        issues.push({
          type: 'test_quality',
          severity: 'medium',
          issue: 'empty_integration_directory',
          description: 'Diretório de testes de integração está vazio',
          recommendation: 'Implementar testes de integração para APIs principais'
        });
      }
      
    } catch (error) {
      issues.push({
        type: 'test_quality',
        severity: 'low',
        issue: 'integration_directory_error',
        description: 'Erro ao acessar diretório de testes de integração',
        recommendation: 'Verificar permissões do diretório'
      });
    }
  }

  /**
   * Obtém lista de arquivos fonte
   */
  getSourceFiles() {
    const sourceFiles = [];
    
    const searchDirs = [
      this.srcDir,
      path.join(this.projectRoot, 'lib'),
      path.join(this.projectRoot, 'app'),
      path.join(this.projectRoot, 'api'),
      path.join(this.projectRoot, 'mcps')
    ];
    
    searchDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.findJSFiles(dir, sourceFiles);
      }
    });
    
    // Adiciona arquivos na raiz
    try {
      const rootFiles = fs.readdirSync(this.projectRoot)
        .filter(file => file.endsWith('.js') && !file.includes('test') && !file.includes('spec'))
        .map(file => path.join(this.projectRoot, file));
      
      sourceFiles.push(...rootFiles);
    } catch (error) {
      // Ignora erro
    }
    
    return sourceFiles;
  }

  /**
   * Obtém lista de arquivos de teste
   */
  getTestFiles() {
    const testFiles = [];
    
    if (fs.existsSync(this.testDir)) {
      this.findTestFiles(this.testDir, testFiles);
    }
    
    // Procura por arquivos de teste na estrutura do projeto
    const searchDirs = [this.srcDir, this.projectRoot];
    
    searchDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.findTestFilesInDir(dir, testFiles);
      }
    });
    
    return testFiles;
  }

  /**
   * Encontra arquivos JS recursivamente
   */
  findJSFiles(dir, files) {
    try {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          this.findJSFiles(fullPath, files);
        } else if (stat.isFile() && item.endsWith('.js') && 
                   !item.includes('test') && !item.includes('spec')) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      // Ignora erros de acesso
    }
  }

  /**
   * Encontra arquivos de teste recursivamente
   */
  findTestFiles(dir, files) {
    try {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.findTestFiles(fullPath, files);
        } else if (stat.isFile() && 
                   (item.endsWith('.test.js') || item.endsWith('.spec.js'))) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      // Ignora erros de acesso
    }
  }

  /**
   * Encontra arquivos de teste em diretório específico
   */
  findTestFilesInDir(dir, files) {
    try {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        if (item.endsWith('.test.js') || item.endsWith('.spec.js')) {
          files.push(path.join(dir, item));
        }
      });
    } catch (error) {
      // Ignora erros de acesso
    }
  }

  /**
   * Encontra arquivos sem testes
   */
  findFilesWithoutTests(sourceFiles, testFiles, issues) {
    sourceFiles.forEach(sourceFile => {
      const relativePath = path.relative(this.projectRoot, sourceFile);
      const baseName = path.basename(sourceFile, '.js');
      
      const hasTest = testFiles.some(testFile => {
        const testBaseName = path.basename(testFile, '.test.js').replace('.spec', '');
        return testBaseName === baseName || testFile.includes(baseName);
      });
      
      if (!hasTest) {
        issues.push({
          type: 'missing_tests',
          severity: 'medium',
          issue: 'file_without_test',
          file: relativePath,
          description: `Arquivo ${relativePath} não possui arquivo de teste correspondente`,
          recommendation: `Criar arquivo de teste para ${relativePath}`
        });
      }
    });
  }

  /**
   * Encontra funções sem testes
   */
  findFunctionsWithoutTests(sourceFiles, testFiles, issues) {
    sourceFiles.forEach(sourceFile => {
      try {
        const content = fs.readFileSync(sourceFile, 'utf8');
        const functions = this.extractFunctions(content);
        
        if (functions.length === 0) return;
        
        const correspondingTest = this.findCorrespondingTest(sourceFile, testFiles);
        
        if (!correspondingTest) return;
        
        const testContent = fs.readFileSync(correspondingTest, 'utf8');
        
        functions.forEach(func => {
          const isTestedPattern = new RegExp(`['"\`].*${func.name}.*['"\`]|${func.name}\\s*\\(`);
          
          if (!isTestedPattern.test(testContent)) {
            issues.push({
              type: 'missing_tests',
              severity: 'low',
              issue: 'function_without_test',
              file: path.relative(this.projectRoot, sourceFile),
              function: func.name,
              line: func.line,
              description: `Função ${func.name} em ${path.relative(this.projectRoot, sourceFile)} não possui teste`,
              recommendation: `Criar teste para a função ${func.name}`
            });
          }
        });
        
      } catch (error) {
        // Ignora erros de leitura
      }
    });
  }

  /**
   * Extrai funções de um arquivo
   */
  extractFunctions(content) {
    const functions = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Padrões para detectar funções
      const patterns = [
        /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
        /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*function/,
        /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\(/,
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*function/,
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*=>/
      ];
      
      patterns.forEach(pattern => {
        const match = line.match(pattern);
        if (match && match[1]) {
          functions.push({
            name: match[1],
            line: index + 1
          });
        }
      });
    });
    
    return functions;
  }

  /**
   * Encontra arquivo de teste correspondente
   */
  findCorrespondingTest(sourceFile, testFiles) {
    const baseName = path.basename(sourceFile, '.js');
    
    return testFiles.find(testFile => {
      const testBaseName = path.basename(testFile, '.test.js').replace('.spec', '');
      return testBaseName === baseName || testFile.includes(baseName);
    });
  }

  /**
   * Encontra cenários de teste faltantes
   */
  findMissingTestScenarios(issues) {
    // Cenários comuns que devem ser testados
    const commonScenarios = [
      'error handling',
      'edge cases',
      'null/undefined inputs',
      'empty inputs',
      'invalid inputs',
      'boundary conditions'
    ];
    
    const testFiles = this.getTestFiles();
    
    testFiles.forEach(testFile => {
      try {
        const content = fs.readFileSync(testFile, 'utf8').toLowerCase();
        
        const missingScenarios = commonScenarios.filter(scenario => 
          !content.includes(scenario.replace(' ', '')) &&
          !content.includes(scenario.replace(' ', '_')) &&
          !content.includes('error') && scenario.includes('error')
        );
        
        if (missingScenarios.length > 0) {
          issues.push({
            type: 'missing_tests',
            severity: 'low',
            issue: 'missing_test_scenarios',
            file: path.relative(this.projectRoot, testFile),
            scenarios: missingScenarios,
            description: `Arquivo ${path.relative(this.projectRoot, testFile)} pode estar faltando cenários de teste`,
            recommendation: 'Considerar adicionar testes para cenários edge case e tratamento de erro'
          });
        }
        
      } catch (error) {
        // Ignora erros de leitura
      }
    });
  }

  /**
   * Analisa testes E2E
   */
  analyzeE2ETests(issues) {
    const e2eDir = path.join(this.testDir, 'e2e');
    
    if (!fs.existsSync(e2eDir)) {
      issues.push({
        type: 'missing_tests',
        severity: 'medium',
        issue: 'no_e2e_tests',
        description: 'Nenhum teste E2E encontrado',
        recommendation: 'Criar testes E2E para fluxos críticos da aplicação'
      });
      return;
    }
    
    try {
      const e2eFiles = fs.readdirSync(e2eDir)
        .filter(file => file.endsWith('.test.js') || file.endsWith('.spec.js'));
      
      if (e2eFiles.length === 0) {
        issues.push({
          type: 'missing_tests',
          severity: 'medium',
          issue: 'empty_e2e_directory',
          description: 'Diretório de testes E2E está vazio',
          recommendation: 'Implementar testes E2E para fluxos principais'
        });
      }
      
    } catch (error) {
      issues.push({
        type: 'missing_tests',
        severity: 'low',
        issue: 'e2e_directory_error',
        description: 'Erro ao acessar diretório de testes E2E',
        recommendation: 'Verificar permissões do diretório'
      });
    }
  }

  /**
   * Analisa estrutura de diretórios de teste
   */
  analyzeTestDirectoryStructure(issues) {
    // Já implementado em analyzeTestFileStructure
  }

  /**
   * Analisa convenções de nomenclatura
   */
  analyzeTestNamingConventions(issues) {
    const testFiles = this.getTestFiles();
    
    testFiles.forEach(testFile => {
      const fileName = path.basename(testFile);
      
      // Verifica convenção de nomenclatura
      if (!fileName.endsWith('.test.js') && !fileName.endsWith('.spec.js')) {
        issues.push({
          type: 'test_structure',
          severity: 'low',
          issue: 'inconsistent_naming',
          file: path.relative(this.projectRoot, testFile),
          description: `Arquivo ${fileName} não segue convenção de nomenclatura`,
          recommendation: 'Usar .test.js ou .spec.js para arquivos de teste'
        });
      }
    });
  }

  /**
   * Analisa setup/teardown
   */
  analyzeTestSetupTeardown(issues) {
    const testFiles = this.getTestFiles();
    
    testFiles.forEach(testFile => {
      try {
        const content = fs.readFileSync(testFile, 'utf8');
        
        const hasBeforeAll = /beforeAll\(/.test(content);
        const hasAfterAll = /afterAll\(/.test(content);
        const hasAsyncTests = /async\s+\(/.test(content) || /\.then\(/.test(content);
        
        if (hasAsyncTests && !hasAfterAll) {
          issues.push({
            type: 'test_structure',
            severity: 'low',
            issue: 'missing_async_cleanup',
            file: path.relative(this.projectRoot, testFile),
            description: `Arquivo ${path.relative(this.projectRoot, testFile)} tem testes async mas pode precisar de cleanup`,
            recommendation: 'Considerar adicionar afterAll() para cleanup de recursos async'
          });
        }
        
      } catch (error) {
        // Ignora erros de leitura
      }
    });
  }

  /**
   * Analisa helpers de teste
   */
  analyzeTestHelpers(issues) {
    const helpersDir = path.join(this.testDir, 'helpers');
    
    if (!fs.existsSync(helpersDir)) {
      const testFiles = this.getTestFiles();
      
      // Verifica se há código duplicado que poderia ser extraído para helpers
      const duplicatedCode = this.findDuplicatedTestCode(testFiles);
      
      if (duplicatedCode.length > 0) {
        issues.push({
          type: 'test_structure',
          severity: 'low',
          issue: 'missing_test_helpers',
          description: 'Código duplicado encontrado nos testes',
          duplications: duplicatedCode.length,
          recommendation: 'Criar helpers para reduzir duplicação de código nos testes'
        });
      }
    }
  }

  /**
   * Encontra código duplicado nos testes
   */
  findDuplicatedTestCode(testFiles) {
    const duplications = [];
    
    // Implementação simplificada - procura por padrões comuns
    const commonPatterns = [
      /const\s+\w+\s*=\s*require\(['"][^'"]+['"]\)/g,
      /beforeEach\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)/g,
      /afterEach\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)/g
    ];
    
    testFiles.forEach(testFile => {
      try {
        const content = fs.readFileSync(testFile, 'utf8');
        
        commonPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches && matches.length > 2) {
            duplications.push({
              file: testFile,
              pattern: pattern.toString(),
              count: matches.length
            });
          }
        });
        
      } catch (error) {
        // Ignora erros de leitura
      }
    });
    
    return duplications;
  }

  /**
   * Gera recomendações baseadas nos resultados
   */
  generateRecommendations(results) {
    const recommendations = [];
    
    // Recomendações de cobertura
    const coverageIssues = results.coverage.filter(issue => 
      issue.issue === 'low_coverage' && issue.severity === 'high'
    );
    
    if (coverageIssues.length > 0) {
      recommendations.push({
        category: 'Cobertura',
        priority: 'critical',
        action: 'Aumentar cobertura de testes críticos',
        items: coverageIssues.map(issue => 
          `Melhorar cobertura de ${issue.metric} em ${issue.file}`
        )
      });
    }
    
    // Recomendações de qualidade
    const qualityIssues = results.testQuality.filter(issue => 
      issue.severity === 'high' || issue.severity === 'medium'
    );
    
    if (qualityIssues.length > 0) {
      recommendations.push({
        category: 'Qualidade',
        priority: 'high',
        action: 'Melhorar qualidade dos testes',
        items: qualityIssues.map(issue => issue.recommendation)
      });
    }
    
    // Recomendações de testes faltantes
    const missingIssues = results.missingTests.filter(issue => 
      issue.severity === 'medium' || issue.severity === 'high'
    );
    
    if (missingIssues.length > 0) {
      recommendations.push({
        category: 'Testes Faltantes',
        priority: 'medium',
        action: 'Implementar testes faltantes',
        items: missingIssues.map(issue => issue.recommendation)
      });
    }
    
    return recommendations;
  }

  /**
   * Calcula resumo da análise
   */
  calculateSummary(results) {
    const allIssues = [
      ...results.coverage,
      ...results.testQuality,
      ...results.missingTests,
      ...results.testStructure
    ];

    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const typeCounts = {
      coverage: results.coverage.length,
      testQuality: results.testQuality.length,
      missingTests: results.missingTests.length,
      testStructure: results.testStructure.length
    };

    allIssues.forEach(issue => {
      severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
    });

    return {
      totalIssues: allIssues.length,
      severityCounts,
      typeCounts,
      testScore: this.calculateTestScore(severityCounts, typeCounts),
      coverageEstimate: this.estimateOverallCoverage(results.coverage)
    };
  }

  /**
   * Calcula score de qualidade dos testes
   */
  calculateTestScore(severityCounts, typeCounts) {
    const maxScore = 100;
    const penalties = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3
    };

    const totalPenalty = Object.entries(severityCounts).reduce((total, [severity, count]) => {
      return total + (count * (penalties[severity] || 0));
    }, 0);

    return Math.max(0, maxScore - totalPenalty);
  }

  /**
   * Estima cobertura geral
   */
  estimateOverallCoverage(coverageIssues) {
    const lowCoverageIssues = coverageIssues.filter(issue => 
      issue.issue === 'low_coverage'
    );
    
    if (lowCoverageIssues.length === 0) {
      return 'Boa (>80%)';
    }
    
    const avgCoverage = lowCoverageIssues.reduce((sum, issue) => 
      sum + (issue.current || 0), 0
    ) / lowCoverageIssues.length;
    
    if (avgCoverage >= 80) return 'Boa (>80%)';
    if (avgCoverage >= 60) return 'Média (60-80%)';
    if (avgCoverage >= 40) return 'Baixa (40-60%)';
    return 'Crítica (<40%)';
  }

  /**
   * Salva relatório em arquivo
   */
  async saveReport(results) {
    try {
      const reportPath = path.join(this.projectRoot, 'test-coverage-analysis-report.json');
      const report = {
        timestamp: new Date().toISOString(),
        projectRoot: this.projectRoot,
        results,
        recommendations: results.recommendations
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Relatório de análise de cobertura salvo em: ${reportPath}`);
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
    }
  }
}

module.exports = TestCoverageAnalyzer;