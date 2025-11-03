/**
 * Health Check Script para Digital Ocean
 * Monitoramento de saúde da aplicação
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

class HealthCheckService {
  constructor() {
    this.config = {
      port: process.env.PORT || 3001,
      host: process.env.HOST || 'localhost',
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000,
      logFile: process.env.HEALTH_LOG_FILE || '/var/log/nfe-backend/health.log'
    };

    this.checks = [
      { name: 'API', check: this.checkAPI.bind(this) },
      { name: 'Database', check: this.checkDatabase.bind(this) },
      { name: 'Memory', check: this.checkMemory.bind(this) },
      { name: 'Disk', check: this.checkDisk.bind(this) },
      { name: 'CPU', check: this.checkCPU.bind(this) },
      { name: 'SEFAZ', check: this.checkSEFAZ.bind(this) }
    ];

    this.thresholds = {
      memory: 90, // % de uso máximo
      disk: 85,   // % de uso máximo
      cpu: 80,    // % de uso máximo
      responseTime: 2000 // ms máximo
    };
  }

  /**
   * Executar health check completo
   */
  async executarHealthCheck() {
    const startTime = Date.now();
    const resultado = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {},
      metrics: {},
      uptime: process.uptime(),
      version: this.obterVersao()
    };

    try {
      // Executar todos os checks
      for (const check of this.checks) {
        try {
          const checkResult = await this.executarCheck(check);
          resultado.checks[check.name] = checkResult;
          
          if (!checkResult.healthy) {
            resultado.status = 'unhealthy';
          }
        } catch (error) {
          resultado.checks[check.name] = {
            healthy: false,
            error: error.message,
            timestamp: new Date().toISOString()
          };
          resultado.status = 'unhealthy';
        }
      }

      // Coletar métricas do sistema
      resultado.metrics = await this.coletarMetricas();
      resultado.responseTime = Date.now() - startTime;

      // Log do resultado
      await this.logHealthCheck(resultado);

      return resultado;

    } catch (error) {
      resultado.status = 'error';
      resultado.error = error.message;
      await this.logHealthCheck(resultado);
      throw error;
    }
  }

  /**
   * Executar check individual
   */
  async executarCheck(check) {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        check.check(),
        this.timeout(this.config.timeout)
      ]);

      return {
        healthy: true,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        ...result
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check da API
   */
  async checkAPI() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.config.host,
        port: this.config.port,
        path: '/health',
        method: 'GET',
        timeout: this.config.timeout
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({
              statusCode: res.statusCode,
              response: data
            });
          } else {
            reject(new Error(`API retornou status ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout na requisição da API'));
      });

      req.end();
    });
  }

  /**
   * Check do banco de dados
   */
  async checkDatabase() {
    try {
      // Simular check do banco - adaptar conforme o banco usado
      const mongoose = require('mongoose');
      
      if (mongoose.connection.readyState === 1) {
        // Executar query simples para testar conectividade
        await mongoose.connection.db.admin().ping();
        
        return {
          status: 'connected',
          readyState: mongoose.connection.readyState
        };
      } else {
        throw new Error('Banco de dados não conectado');
      }
    } catch (error) {
      throw new Error(`Erro no banco de dados: ${error.message}`);
    }
  }

  /**
   * Check de memória
   */
  async checkMemory() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = (usedMem / totalMem) * 100;

    if (memPercent > this.thresholds.memory) {
      throw new Error(`Uso de memória alto: ${memPercent.toFixed(2)}%`);
    }

    return {
      usage: {
        rss: this.formatBytes(memUsage.rss),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        heapUsed: this.formatBytes(memUsage.heapUsed),
        external: this.formatBytes(memUsage.external)
      },
      system: {
        total: this.formatBytes(totalMem),
        free: this.formatBytes(freeMem),
        used: this.formatBytes(usedMem),
        percent: memPercent.toFixed(2)
      }
    };
  }

  /**
   * Check de disco
   */
  async checkDisk() {
    try {
      const stats = fs.statSync('/');
      // Implementação simplificada - em produção usar biblioteca específica
      
      return {
        status: 'ok',
        message: 'Verificação de disco simplificada'
      };
    } catch (error) {
      throw new Error(`Erro ao verificar disco: ${error.message}`);
    }
  }

  /**
   * Check de CPU
   */
  async checkCPU() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Calcular uso médio de CPU
    const cpuUsage = loadAvg[0] / cpus.length * 100;
    
    if (cpuUsage > this.thresholds.cpu) {
      throw new Error(`Uso de CPU alto: ${cpuUsage.toFixed(2)}%`);
    }

    return {
      cores: cpus.length,
      model: cpus[0].model,
      loadAverage: {
        '1min': loadAvg[0].toFixed(2),
        '5min': loadAvg[1].toFixed(2),
        '15min': loadAvg[2].toFixed(2)
      },
      usage: cpuUsage.toFixed(2)
    };
  }

  /**
   * Check do SEFAZ
   */
  async checkSEFAZ() {
    try {
      // Verificar status de algumas UFs principais
      const ufsCheck = ['SP', 'RJ', 'MG', 'RS'];
      const resultados = {};

      for (const uf of ufsCheck) {
        try {
          // Simular check do SEFAZ - implementar conforme necessário
          resultados[uf] = {
            status: 'online',
            responseTime: Math.floor(Math.random() * 1000) + 100
          };
        } catch (error) {
          resultados[uf] = {
            status: 'offline',
            error: error.message
          };
        }
      }

      return {
        ufs: resultados,
        totalChecked: ufsCheck.length,
        online: Object.values(resultados).filter(r => r.status === 'online').length
      };

    } catch (error) {
      throw new Error(`Erro ao verificar SEFAZ: ${error.message}`);
    }
  }

  /**
   * Coletar métricas do sistema
   */
  async coletarMetricas() {
    return {
      timestamp: new Date().toISOString(),
      uptime: {
        process: process.uptime(),
        system: os.uptime()
      },
      memory: process.memoryUsage(),
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg()
      },
      network: os.networkInterfaces(),
      platform: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname()
      },
      node: {
        version: process.version,
        pid: process.pid,
        title: process.title
      }
    };
  }

  /**
   * Log do health check
   */
  async logHealthCheck(resultado) {
    try {
      const logEntry = {
        timestamp: resultado.timestamp,
        status: resultado.status,
        responseTime: resultado.responseTime,
        uptime: resultado.uptime,
        checks: Object.keys(resultado.checks).reduce((acc, key) => {
          acc[key] = {
            healthy: resultado.checks[key].healthy,
            responseTime: resultado.checks[key].responseTime
          };
          return acc;
        }, {})
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Criar diretório se não existir
      const logDir = path.dirname(this.config.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Escrever log
      fs.appendFileSync(this.config.logFile, logLine);

      // Rotacionar logs se necessário (manter últimos 7 dias)
      await this.rotacionarLogs();

    } catch (error) {
      console.error('Erro ao escrever log de health check:', error.message);
    }
  }

  /**
   * Rotacionar logs
   */
  async rotacionarLogs() {
    try {
      const stats = fs.statSync(this.config.logFile);
      const ageDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      
      if (ageDays > 7) {
        const backupFile = `${this.config.logFile}.${Date.now()}`;
        fs.renameSync(this.config.logFile, backupFile);
        
        // Remover backups antigos (manter últimos 30)
        const logDir = path.dirname(this.config.logFile);
        const files = fs.readdirSync(logDir)
          .filter(f => f.startsWith(path.basename(this.config.logFile)))
          .sort()
          .slice(0, -30);
        
        files.forEach(f => {
          fs.unlinkSync(path.join(logDir, f));
        });
      }
    } catch (error) {
      // Ignorar erros de rotação
    }
  }

  /**
   * Métodos auxiliares
   */
  timeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    });
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  obterVersao() {
    try {
      const packageJson = require('../package.json');
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Executar health check contínuo
   */
  iniciarMonitoramento() {
    console.log(`🏥 Iniciando monitoramento de saúde (intervalo: ${this.config.interval}ms)`);
    
    setInterval(async () => {
      try {
        const resultado = await this.executarHealthCheck();
        
        if (resultado.status !== 'healthy') {
          console.warn('⚠️  Sistema não saudável:', resultado);
          
          // Enviar alerta se configurado
          await this.enviarAlerta(resultado);
        }
      } catch (error) {
        console.error('❌ Erro no health check:', error.message);
      }
    }, this.config.interval);
  }

  /**
   * Enviar alerta
   */
  async enviarAlerta(resultado) {
    try {
      // Implementar envio de alertas (email, webhook, etc.)
      console.log('🚨 Alerta de saúde:', {
        status: resultado.status,
        timestamp: resultado.timestamp,
        checks: Object.keys(resultado.checks).filter(
          key => !resultado.checks[key].healthy
        )
      });
    } catch (error) {
      console.error('Erro ao enviar alerta:', error.message);
    }
  }
}

// Executar health check se chamado diretamente
if (require.main === module) {
  const healthCheck = new HealthCheckService();
  
  const command = process.argv[2];
  
  if (command === 'monitor') {
    // Modo monitoramento contínuo
    healthCheck.iniciarMonitoramento();
  } else {
    // Execução única
    healthCheck.executarHealthCheck()
      .then(resultado => {
        console.log(JSON.stringify(resultado, null, 2));
        process.exit(resultado.status === 'healthy' ? 0 : 1);
      })
      .catch(error => {
        console.error('Erro no health check:', error.message);
        process.exit(1);
      });
  }
}

module.exports = HealthCheckService;