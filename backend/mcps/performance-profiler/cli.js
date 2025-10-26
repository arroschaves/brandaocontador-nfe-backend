#!/usr/bin/env node

const PerformanceProfiler = require('./index');
const path = require('path');
const fs = require('fs');

/**
 * CLI para Performance Profiler MCP
 */
class PerformanceProfilerCLI {
  constructor() {
    this.profiler = null;
    this.options = {
      project: process.cwd(),
      output: null,
      duration: 30000, // 30 segundos por padrão
      benchmark: false,
      io: false,
      verbose: false
    };
  }

  /**
   * Processa argumentos da linha de comando
   */
  parseArgs(args) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--project':
        case '-p':
          this.options.project = args[++i];
          break;
        case '--output':
        case '-o':
          this.options.output = args[++i];
          break;
        case '--duration':
        case '-d':
          this.options.duration = parseInt(args[++i]) * 1000; // Converte para ms
          break;
        case '--benchmark':
        case '-b':
          this.options.benchmark = true;
          break;
        case '--io':
          this.options.io = true;
          break;
        case '--verbose':
        case '-v':
          this.options.verbose = true;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
      }
    }
  }

  /**
   * Mostra ajuda
   */
  showHelp() {
    console.log(`
🔍 Performance Profiler MCP - Análise de Performance

USAGE:
  node cli.js [options]

OPTIONS:
  -p, --project <path>     Caminho do projeto (padrão: diretório atual)
  -o, --output <file>      Arquivo de saída do relatório
  -d, --duration <sec>     Duração do profiling em segundos (padrão: 30)
  -b, --benchmark          Executa benchmarks de I/O
  --io                     Analisa performance de I/O
  -v, --verbose            Saída detalhada
  -h, --help               Mostra esta ajuda

EXAMPLES:
  node cli.js --project /path/to/project --duration 60
  node cli.js --benchmark --io --output report.json
  node cli.js --verbose --duration 120
    `);
  }

  /**
   * Executa análise de performance
   */
  async run(args) {
    this.parseArgs(args);
    
    if (this.options.verbose) {
      console.log('🔍 Iniciando Performance Profiler MCP');
      console.log(`📁 Projeto: ${this.options.project}`);
      console.log(`⏱️  Duração: ${this.options.duration / 1000}s`);
    }
    
    try {
      // Verifica se o projeto existe
      if (!fs.existsSync(this.options.project)) {
        console.error(`❌ Projeto não encontrado: ${this.options.project}`);
        process.exit(1);
      }
      
      // Inicializa profiler
      this.profiler = new PerformanceProfiler({
        projectRoot: this.options.project
      });
      
      // Inicia profiling
      this.profiler.startProfiling();
      
      // Executa benchmarks se solicitado
      if (this.options.benchmark) {
        await this.runBenchmarks();
      }
      
      // Analisa I/O se solicitado
      if (this.options.io) {
        await this.analyzeIO();
      }
      
      // Aguarda duração especificada
      if (this.options.verbose) {
        console.log(`⏳ Coletando métricas por ${this.options.duration / 1000} segundos...`);
      }
      
      await this.sleep(this.options.duration);
      
      // Para profiling e gera relatório
      const report = this.profiler.stopProfiling();
      
      // Exibe resumo
      this.displaySummary(report);
      
      // Salva relatório se especificado
      if (this.options.output) {
        await this.profiler.saveReport(report, this.options.output);
      }
      
      // Exibe recomendações
      this.displayRecommendations(report);
      
    } catch (error) {
      console.error('❌ Erro durante análise:', error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Executa benchmarks
   */
  async runBenchmarks() {
    console.log('🏃 Executando benchmarks...');
    
    // Benchmark de operação simples
    await this.profiler.benchmark('simple_operation', () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      return sum;
    }, 1000);
    
    // Benchmark de operação assíncrona
    await this.profiler.benchmark('async_operation', async () => {
      return new Promise(resolve => {
        setTimeout(resolve, 1);
      });
    }, 100);
    
    // Benchmark de JSON parsing
    const testData = JSON.stringify({ test: 'data', array: [1, 2, 3, 4, 5] });
    await this.profiler.benchmark('json_parse', () => {
      JSON.parse(testData);
    }, 1000);
    
    console.log('✅ Benchmarks concluídos');
  }

  /**
   * Analisa performance de I/O
   */
  async analyzeIO() {
    console.log('💾 Analisando performance de I/O...');
    
    const ioAnalysis = await this.profiler.analyzeIOPerformance();
    
    if (this.options.verbose) {
      console.log('📊 Resultados de I/O:');
      ioAnalysis.tests.forEach(test => {
        if (!test.error) {
          console.log(`  ${test.name}: ${test.stats.mean.toFixed(2)}ms (média)`);
        }
      });
    }
    
    console.log('✅ Análise de I/O concluída');
  }

  /**
   * Exibe resumo do relatório
   */
  displaySummary(report) {
    console.log('\n📊 RESUMO DA ANÁLISE DE PERFORMANCE');
    console.log('=====================================');
    
    console.log(`⏱️  Duração: ${(report.duration / 1000).toFixed(2)}s`);
    console.log(`🧠 Memory Leaks: ${report.summary.memoryLeaksDetected ? '❌ DETECTADOS' : '✅ Não detectados'}`);
    console.log(`⚠️  Problemas: ${report.summary.performanceIssues}`);
    console.log(`🏃 Benchmarks: ${report.summary.benchmarksRun}`);
    
    // Métricas de memória
    if (report.memoryAnalysis.usage.current) {
      const memUsage = report.memoryAnalysis.usage.current;
      console.log(`\n💾 MEMÓRIA:`);
      console.log(`  Heap Usado: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // Métricas de CPU
    if (report.cpuAnalysis.usage.current) {
      console.log(`\n🖥️  CPU:`);
      console.log(`  Load Average: ${report.cpuAnalysis.usage.averageLoad.toFixed(2)}`);
      console.log(`  CPU Count: ${report.cpuAnalysis.usage.cpuCount}`);
      console.log(`  Load %: ${report.cpuAnalysis.usage.loadPercentage.toFixed(2)}%`);
    }
    
    // Event Loop
    if (report.eventLoopAnalysis.lag.average !== undefined) {
      console.log(`\n🔄 EVENT LOOP:`);
      console.log(`  Lag Médio: ${report.eventLoopAnalysis.lag.average.toFixed(2)}ms`);
      console.log(`  Lag Máximo: ${report.eventLoopAnalysis.lag.maximum.toFixed(2)}ms`);
      console.log(`  Status: ${this.getEventLoopStatus(report.eventLoopAnalysis.lag.status)}`);
    }
    
    // Benchmarks
    if (report.benchmarks.length > 0) {
      console.log(`\n🏃 BENCHMARKS:`);
      report.benchmarks.forEach(benchmark => {
        console.log(`  ${benchmark.name}: ${benchmark.stats.mean.toFixed(2)}ms (${benchmark.iterations} iterações)`);
      });
    }
  }

  /**
   * Retorna status formatado do Event Loop
   */
  getEventLoopStatus(status) {
    switch (status) {
      case 'good': return '✅ Bom';
      case 'moderate': return '⚠️ Moderado';
      case 'concerning': return '❌ Preocupante';
      default: return '❓ Desconhecido';
    }
  }

  /**
   * Exibe recomendações
   */
  displayRecommendations(report) {
    const allRecommendations = [
      ...report.memoryAnalysis.recommendations,
      ...report.cpuAnalysis.recommendations,
      ...report.eventLoopAnalysis.recommendations,
      ...report.recommendations
    ];
    
    if (allRecommendations.length === 0) {
      console.log('\n✅ Nenhuma recomendação de performance encontrada!');
      return;
    }
    
    console.log('\n💡 RECOMENDAÇÕES');
    console.log('================');
    
    const critical = allRecommendations.filter(r => r.priority === 'critical');
    const high = allRecommendations.filter(r => r.priority === 'high');
    const medium = allRecommendations.filter(r => r.priority === 'medium');
    const low = allRecommendations.filter(r => r.priority === 'low');
    
    if (critical.length > 0) {
      console.log('\n🚨 CRÍTICAS:');
      critical.forEach(rec => {
        console.log(`  • ${rec.action}`);
        if (rec.details) console.log(`    ${rec.details}`);
      });
    }
    
    if (high.length > 0) {
      console.log('\n🔴 ALTAS:');
      high.forEach(rec => {
        console.log(`  • ${rec.action}`);
        if (rec.details) console.log(`    ${rec.details}`);
      });
    }
    
    if (medium.length > 0) {
      console.log('\n🟡 MÉDIAS:');
      medium.forEach(rec => {
        console.log(`  • ${rec.action}`);
        if (rec.details) console.log(`    ${rec.details}`);
      });
    }
    
    if (low.length > 0 && this.options.verbose) {
      console.log('\n🟢 BAIXAS:');
      low.forEach(rec => {
        console.log(`  • ${rec.action}`);
        if (rec.details) console.log(`    ${rec.details}`);
      });
    }
  }

  /**
   * Função auxiliar para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Executa CLI se chamado diretamente
if (require.main === module) {
  const cli = new PerformanceProfilerCLI();
  cli.run(process.argv.slice(2));
}

module.exports = PerformanceProfilerCLI;