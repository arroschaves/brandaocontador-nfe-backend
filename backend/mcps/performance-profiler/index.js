const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const v8 = require('v8');
const os = require('os');

/**
 * MCP Performance Profiler
 * Analisa performance de código, detecta memory leaks, profiling de CPU e I/O
 */
class PerformanceProfiler {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.excludePatterns = options.excludePatterns || [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.nyc_output'
    ];
    
    this.metrics = {
      memory: [],
      cpu: [],
      io: [],
      gc: [],
      eventLoop: []
    };
    
    this.benchmarks = new Map();
    this.memoryLeakDetection = {
      enabled: false,
      snapshots: [],
      threshold: 50 * 1024 * 1024 // 50MB
    };
    
    this.profiling = {
      active: false,
      startTime: null,
      samples: []
    };
  }

  /**
   * Inicia o profiling de performance
   */
  startProfiling() {
    this.profiling.active = true;
    this.profiling.startTime = performance.now();
    this.profiling.samples = [];
    
    // Inicia coleta de métricas
    this.startMetricsCollection();
    
    // Inicia detecção de memory leaks
    this.startMemoryLeakDetection();
    
    console.log('🔍 Performance profiling iniciado');
  }

  /**
   * Para o profiling de performance
   */
  stopProfiling() {
    this.profiling.active = false;
    this.stopMetricsCollection();
    this.stopMemoryLeakDetection();
    
    const duration = performance.now() - this.profiling.startTime;
    console.log(`✅ Performance profiling finalizado (${duration.toFixed(2)}ms)`);
    
    return this.generateReport();
  }

  /**
   * Inicia coleta de métricas do sistema
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      if (!this.profiling.active) return;
      
      this.collectMemoryMetrics();
      this.collectCpuMetrics();
      this.collectEventLoopMetrics();
      this.collectGcMetrics();
    }, 1000); // Coleta a cada segundo
  }

  /**
   * Para coleta de métricas
   */
  stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Coleta métricas de memória
   */
  collectMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    const memoryMetric = {
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      heapSizeLimit: heapStats.heap_size_limit,
      totalHeapSize: heapStats.total_heap_size,
      usedHeapSize: heapStats.used_heap_size,
      mallocedMemory: heapStats.malloced_memory,
      peakMallocedMemory: heapStats.peak_malloced_memory
    };
    
    this.metrics.memory.push(memoryMetric);
  }

  /**
   * Coleta métricas de CPU
   */
  collectCpuMetrics() {
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    const cpuMetric = {
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system,
      loadAverage: loadAvg,
      cpuCount: os.cpus().length
    };
    
    this.metrics.cpu.push(cpuMetric);
  }

  /**
   * Coleta métricas do Event Loop
   */
  collectEventLoopMetrics() {
    const start = performance.now();
    
    setImmediate(() => {
      const lag = performance.now() - start;
      
      this.metrics.eventLoop.push({
        timestamp: Date.now(),
        lag: lag
      });
    });
  }

  /**
   * Coleta métricas de Garbage Collection
   */
  collectGcMetrics() {
    const heapSpaceStats = v8.getHeapSpaceStatistics();
    
    const gcMetric = {
      timestamp: Date.now(),
      heapSpaces: heapSpaceStats.map(space => ({
        name: space.space_name,
        size: space.space_size,
        used: space.space_used_size,
        available: space.space_available_size,
        physicalSize: space.physical_space_size
      }))
    };
    
    this.metrics.gc.push(gcMetric);
  }

  /**
   * Inicia detecção de memory leaks
   */
  startMemoryLeakDetection() {
    this.memoryLeakDetection.enabled = true;
    this.memoryLeakDetection.snapshots = [];
    
    // Tira snapshot inicial
    this.takeMemorySnapshot();
    
    // Agenda snapshots periódicos
    this.memoryLeakInterval = setInterval(() => {
      if (!this.memoryLeakDetection.enabled) return;
      this.takeMemorySnapshot();
    }, 30000); // A cada 30 segundos
  }

  /**
   * Para detecção de memory leaks
   */
  stopMemoryLeakDetection() {
    this.memoryLeakDetection.enabled = false;
    
    if (this.memoryLeakInterval) {
      clearInterval(this.memoryLeakInterval);
      this.memoryLeakInterval = null;
    }
  }

  /**
   * Tira snapshot da memória
   */
  takeMemorySnapshot() {
    const memUsage = process.memoryUsage();
    const heapSnapshot = v8.writeHeapSnapshot();
    
    const snapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      snapshotFile: heapSnapshot
    };
    
    this.memoryLeakDetection.snapshots.push(snapshot);
    
    // Remove snapshots antigos (mantém apenas os últimos 10)
    if (this.memoryLeakDetection.snapshots.length > 10) {
      const oldSnapshot = this.memoryLeakDetection.snapshots.shift();
      // Remove arquivo de snapshot antigo
      try {
        fs.unlinkSync(oldSnapshot.snapshotFile);
      } catch (error) {
        // Ignora erro se arquivo não existir
      }
    }
  }

  /**
   * Detecta possíveis memory leaks
   */
  detectMemoryLeaks() {
    const snapshots = this.memoryLeakDetection.snapshots;
    if (snapshots.length < 3) {
      return { detected: false, reason: 'Insufficient snapshots' };
    }
    
    const recent = snapshots.slice(-3);
    const growthRate = this.calculateMemoryGrowthRate(recent);
    
    // Verifica crescimento consistente
    const isGrowing = growthRate > 0.1; // 10% de crescimento
    const exceedsThreshold = recent[recent.length - 1].heapUsed > this.memoryLeakDetection.threshold;
    
    if (isGrowing && exceedsThreshold) {
      return {
        detected: true,
        growthRate: growthRate,
        currentUsage: recent[recent.length - 1].heapUsed,
        threshold: this.memoryLeakDetection.threshold,
        snapshots: recent
      };
    }
    
    return { detected: false, growthRate: growthRate };
  }

  /**
   * Calcula taxa de crescimento da memória
   */
  calculateMemoryGrowthRate(snapshots) {
    if (snapshots.length < 2) return 0;
    
    const first = snapshots[0].heapUsed;
    const last = snapshots[snapshots.length - 1].heapUsed;
    
    return (last - first) / first;
  }

  /**
   * Executa benchmark de uma função
   */
  async benchmark(name, fn, iterations = 1000) {
    console.log(`🏃 Executando benchmark: ${name} (${iterations} iterações)`);
    
    const results = [];
    
    // Warm-up
    for (let i = 0; i < Math.min(100, iterations / 10); i++) {
      await fn();
    }
    
    // Força garbage collection antes do benchmark
    if (global.gc) {
      global.gc();
    }
    
    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      await fn();
      const iterationEnd = performance.now();
      
      results.push(iterationEnd - iterationStart);
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const stats = this.calculateBenchmarkStats(results);
    
    const benchmark = {
      name,
      iterations,
      totalTime: endTime - startTime,
      memoryDelta: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        rss: endMemory.rss - startMemory.rss
      },
      stats
    };
    
    this.benchmarks.set(name, benchmark);
    
    console.log(`✅ Benchmark ${name} concluído: ${stats.mean.toFixed(2)}ms (média)`);
    
    return benchmark;
  }

  /**
   * Calcula estatísticas do benchmark
   */
  calculateBenchmarkStats(results) {
    const sorted = results.slice().sort((a, b) => a - b);
    const sum = results.reduce((a, b) => a + b, 0);
    
    return {
      min: Math.min(...results),
      max: Math.max(...results),
      mean: sum / results.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: this.calculateStandardDeviation(results, sum / results.length)
    };
  }

  /**
   * Calcula desvio padrão
   */
  calculateStandardDeviation(values, mean) {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Analisa performance de I/O
   */
  async analyzeIOPerformance() {
    const ioTests = [];
    
    // Teste de leitura de arquivo
    const readTest = await this.benchmarkFileRead();
    ioTests.push(readTest);
    
    // Teste de escrita de arquivo
    const writeTest = await this.benchmarkFileWrite();
    ioTests.push(writeTest);
    
    // Teste de operações de diretório
    const dirTest = await this.benchmarkDirectoryOperations();
    ioTests.push(dirTest);
    
    return {
      tests: ioTests,
      summary: this.summarizeIOTests(ioTests)
    };
  }

  /**
   * Benchmark de leitura de arquivo
   */
  async benchmarkFileRead() {
    const testFile = path.join(this.projectRoot, 'package.json');
    
    if (!fs.existsSync(testFile)) {
      return { name: 'file_read', error: 'Test file not found' };
    }
    
    return await this.benchmark('file_read', () => {
      return new Promise((resolve, reject) => {
        fs.readFile(testFile, 'utf8', (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    }, 100);
  }

  /**
   * Benchmark de escrita de arquivo
   */
  async benchmarkFileWrite() {
    const testFile = path.join(this.projectRoot, '.perf-test-write.tmp');
    const testData = 'Performance test data\n'.repeat(100);
    
    const result = await this.benchmark('file_write', () => {
      return new Promise((resolve, reject) => {
        fs.writeFile(testFile, testData, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }, 50);
    
    // Limpa arquivo de teste
    try {
      fs.unlinkSync(testFile);
    } catch (error) {
      // Ignora erro
    }
    
    return result;
  }

  /**
   * Benchmark de operações de diretório
   */
  async benchmarkDirectoryOperations() {
    return await this.benchmark('directory_operations', () => {
      return new Promise((resolve, reject) => {
        fs.readdir(this.projectRoot, (err, files) => {
          if (err) reject(err);
          else resolve(files);
        });
      });
    }, 100);
  }

  /**
   * Sumariza testes de I/O
   */
  summarizeIOTests(tests) {
    const validTests = tests.filter(test => !test.error);
    
    if (validTests.length === 0) {
      return { status: 'error', message: 'No valid I/O tests completed' };
    }
    
    const avgTime = validTests.reduce((sum, test) => sum + test.stats.mean, 0) / validTests.length;
    
    return {
      status: 'success',
      testsCompleted: validTests.length,
      averageTime: avgTime,
      slowestTest: validTests.reduce((slowest, test) => 
        test.stats.mean > slowest.stats.mean ? test : slowest
      ),
      fastestTest: validTests.reduce((fastest, test) => 
        test.stats.mean < fastest.stats.mean ? test : fastest
      )
    };
  }

  /**
   * Gera relatório completo de performance
   */
  generateReport() {
    const memoryLeaks = this.detectMemoryLeaks();
    const performanceIssues = this.analyzePerformanceIssues();
    
    return {
      timestamp: new Date().toISOString(),
      duration: this.profiling.active ? 0 : performance.now() - this.profiling.startTime,
      summary: {
        memoryLeaksDetected: memoryLeaks.detected,
        performanceIssues: performanceIssues.length,
        benchmarksRun: this.benchmarks.size,
        metricsCollected: {
          memory: this.metrics.memory.length,
          cpu: this.metrics.cpu.length,
          eventLoop: this.metrics.eventLoop.length,
          gc: this.metrics.gc.length
        }
      },
      memoryAnalysis: {
        leakDetection: memoryLeaks,
        usage: this.analyzeMemoryUsage(),
        recommendations: this.generateMemoryRecommendations()
      },
      cpuAnalysis: {
        usage: this.analyzeCpuUsage(),
        recommendations: this.generateCpuRecommendations()
      },
      eventLoopAnalysis: {
        lag: this.analyzeEventLoopLag(),
        recommendations: this.generateEventLoopRecommendations()
      },
      benchmarks: Array.from(this.benchmarks.values()),
      performanceIssues: performanceIssues,
      recommendations: this.generateOverallRecommendations()
    };
  }

  /**
   * Analisa uso de memória
   */
  analyzeMemoryUsage() {
    if (this.metrics.memory.length === 0) {
      return { status: 'no_data' };
    }
    
    const latest = this.metrics.memory[this.metrics.memory.length - 1];
    const first = this.metrics.memory[0];
    
    return {
      current: latest,
      growth: {
        heapUsed: latest.heapUsed - first.heapUsed,
        heapTotal: latest.heapTotal - first.heapTotal,
        rss: latest.rss - first.rss
      },
      peak: {
        heapUsed: Math.max(...this.metrics.memory.map(m => m.heapUsed)),
        heapTotal: Math.max(...this.metrics.memory.map(m => m.heapTotal)),
        rss: Math.max(...this.metrics.memory.map(m => m.rss))
      },
      average: {
        heapUsed: this.metrics.memory.reduce((sum, m) => sum + m.heapUsed, 0) / this.metrics.memory.length,
        heapTotal: this.metrics.memory.reduce((sum, m) => sum + m.heapTotal, 0) / this.metrics.memory.length,
        rss: this.metrics.memory.reduce((sum, m) => sum + m.rss, 0) / this.metrics.memory.length
      }
    };
  }

  /**
   * Analisa uso de CPU
   */
  analyzeCpuUsage() {
    if (this.metrics.cpu.length === 0) {
      return { status: 'no_data' };
    }
    
    const latest = this.metrics.cpu[this.metrics.cpu.length - 1];
    const avgLoad = this.metrics.cpu.reduce((sum, c) => sum + c.loadAverage[0], 0) / this.metrics.cpu.length;
    
    return {
      current: latest,
      averageLoad: avgLoad,
      cpuCount: latest.cpuCount,
      loadPercentage: (avgLoad / latest.cpuCount) * 100
    };
  }

  /**
   * Analisa lag do Event Loop
   */
  analyzeEventLoopLag() {
    if (this.metrics.eventLoop.length === 0) {
      return { status: 'no_data' };
    }
    
    const lags = this.metrics.eventLoop.map(e => e.lag);
    const avgLag = lags.reduce((sum, lag) => sum + lag, 0) / lags.length;
    const maxLag = Math.max(...lags);
    
    return {
      average: avgLag,
      maximum: maxLag,
      samples: lags.length,
      status: maxLag > 100 ? 'concerning' : avgLag > 50 ? 'moderate' : 'good'
    };
  }

  /**
   * Analisa problemas de performance
   */
  analyzePerformanceIssues() {
    const issues = [];
    
    // Verifica uso excessivo de memória
    const memoryAnalysis = this.analyzeMemoryUsage();
    if (memoryAnalysis.current && memoryAnalysis.current.heapUsed > 100 * 1024 * 1024) {
      issues.push({
        type: 'memory',
        severity: 'high',
        issue: 'High memory usage',
        details: `Heap usage: ${(memoryAnalysis.current.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        recommendation: 'Investigate memory leaks and optimize memory usage'
      });
    }
    
    // Verifica lag do Event Loop
    const eventLoopAnalysis = this.analyzeEventLoopLag();
    if (eventLoopAnalysis.average > 50) {
      issues.push({
        type: 'event_loop',
        severity: eventLoopAnalysis.average > 100 ? 'high' : 'medium',
        issue: 'High Event Loop lag',
        details: `Average lag: ${eventLoopAnalysis.average.toFixed(2)}ms`,
        recommendation: 'Optimize synchronous operations and consider using worker threads'
      });
    }
    
    // Verifica benchmarks lentos
    for (const benchmark of this.benchmarks.values()) {
      if (benchmark.stats.mean > 100) {
        issues.push({
          type: 'benchmark',
          severity: 'medium',
          issue: `Slow benchmark: ${benchmark.name}`,
          details: `Average time: ${benchmark.stats.mean.toFixed(2)}ms`,
          recommendation: 'Optimize the benchmarked function'
        });
      }
    }
    
    return issues;
  }

  /**
   * Gera recomendações de memória
   */
  generateMemoryRecommendations() {
    const recommendations = [];
    const memoryAnalysis = this.analyzeMemoryUsage();
    
    if (memoryAnalysis.current) {
      const heapUsageMB = memoryAnalysis.current.heapUsed / 1024 / 1024;
      
      if (heapUsageMB > 100) {
        recommendations.push({
          priority: 'high',
          action: 'Investigate memory usage',
          details: 'High heap usage detected. Consider memory profiling.'
        });
      }
      
      if (memoryAnalysis.growth.heapUsed > 50 * 1024 * 1024) {
        recommendations.push({
          priority: 'medium',
          action: 'Monitor memory growth',
          details: 'Significant memory growth detected during profiling.'
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Gera recomendações de CPU
   */
  generateCpuRecommendations() {
    const recommendations = [];
    const cpuAnalysis = this.analyzeCpuUsage();
    
    if (cpuAnalysis.loadPercentage > 80) {
      recommendations.push({
        priority: 'high',
        action: 'Optimize CPU usage',
        details: 'High CPU load detected. Consider optimizing algorithms.'
      });
    }
    
    return recommendations;
  }

  /**
   * Gera recomendações do Event Loop
   */
  generateEventLoopRecommendations() {
    const recommendations = [];
    const eventLoopAnalysis = this.analyzeEventLoopLag();
    
    if (eventLoopAnalysis.average > 50) {
      recommendations.push({
        priority: 'medium',
        action: 'Reduce Event Loop blocking',
        details: 'High Event Loop lag detected. Avoid synchronous operations.'
      });
    }
    
    return recommendations;
  }

  /**
   * Gera recomendações gerais
   */
  generateOverallRecommendations() {
    const recommendations = [];
    const issues = this.analyzePerformanceIssues();
    
    const highIssues = issues.filter(i => i.severity === 'high');
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    
    if (highIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Address high-priority performance issues',
        details: `${highIssues.length} critical performance issues detected`
      });
    }
    
    if (mediumIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Optimize moderate performance issues',
        details: `${mediumIssues.length} moderate performance issues detected`
      });
    }
    
    if (this.benchmarks.size === 0) {
      recommendations.push({
        priority: 'low',
        action: 'Add performance benchmarks',
        details: 'No benchmarks were run during profiling'
      });
    }
    
    return recommendations;
  }

  /**
   * Salva relatório em arquivo
   */
  async saveReport(report, outputPath) {
    const reportWithMetadata = {
      metadata: {
        analyzer: 'Performance Profiler MCP',
        version: '1.0.0',
        projectRoot: this.projectRoot,
        generatedAt: new Date().toISOString()
      },
      ...report
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(reportWithMetadata, null, 2));
    console.log(`📊 Relatório salvo em: ${outputPath}`);
  }
}

module.exports = PerformanceProfiler;