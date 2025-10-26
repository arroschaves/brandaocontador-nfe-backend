/**
 * Sistema de Monitoramento de Performance
 * Monitora métricas críticas do sistema em produção
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                success: 0,
                errors: 0,
                avgResponseTime: 0,
                slowRequests: 0
            },
            system: {
                cpuUsage: 0,
                memoryUsage: 0,
                diskUsage: 0,
                uptime: 0
            },
            database: {
                connections: 0,
                queries: 0,
                slowQueries: 0,
                errors: 0
            },
            nfe: {
                emissoes: 0,
                sucessos: 0,
                erros: 0,
                tempoMedio: 0
            }
        };
        
        this.responseTimes = [];
        this.slowRequestThreshold = 5000; // 5 segundos
        this.monitoringInterval = null;
        this.logPath = path.join(__dirname, '..', 'logs', 'performance.log');
    }

    // ==================== MIDDLEWARE DE MONITORAMENTO ====================
    
    requestMonitor() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Incrementar contador de requisições
            this.metrics.requests.total++;
            
            // Monitorar resposta
            res.on('finish', () => {
                const responseTime = Date.now() - startTime;
                this.recordResponseTime(responseTime);
                
                // Classificar resposta
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    this.metrics.requests.success++;
                } else {
                    this.metrics.requests.errors++;
                }
                
                // Detectar requisições lentas
                if (responseTime > this.slowRequestThreshold) {
                    this.metrics.requests.slowRequests++;
                    this.logSlowRequest(req, responseTime);
                }
            });
            
            next();
        };
    }

    recordResponseTime(responseTime) {
        this.responseTimes.push(responseTime);
        
        // Manter apenas os últimos 1000 tempos de resposta
        if (this.responseTimes.length > 1000) {
            this.responseTimes.shift();
        }
        
        // Calcular tempo médio
        this.metrics.requests.avgResponseTime = 
            this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    // ==================== MONITORAMENTO DO SISTEMA ====================
    
    startSystemMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, 30000); // A cada 30 segundos
        
        console.log('📊 Monitoramento de performance iniciado');
    }

    stopSystemMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('📊 Monitoramento de performance parado');
        }
    }

    async collectSystemMetrics() {
        try {
            // CPU Usage
            const cpus = os.cpus();
            let totalIdle = 0;
            let totalTick = 0;
            
            cpus.forEach(cpu => {
                for (const type in cpu.times) {
                    totalTick += cpu.times[type];
                }
                totalIdle += cpu.times.idle;
            });
            
            this.metrics.system.cpuUsage = 100 - (totalIdle / totalTick * 100);
            
            // Memory Usage
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            this.metrics.system.memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
            
            // Uptime
            this.metrics.system.uptime = os.uptime();
            
            // Disk Usage (se possível)
            await this.checkDiskUsage();
            
            // Log métricas se necessário
            await this.logMetricsIfNeeded();
            
        } catch (error) {
            console.error('❌ Erro ao coletar métricas do sistema:', error.message);
        }
    }

    async checkDiskUsage() {
        try {
            const stats = await fs.stat(process.cwd());
            // Implementação básica - pode ser melhorada com bibliotecas específicas
            this.metrics.system.diskUsage = 0; // Placeholder
        } catch (error) {
            // Ignorar erro de disk usage por enquanto
        }
    }

    // ==================== MONITORAMENTO DE NFE ====================
    
    recordNFeEmission(success, responseTime) {
        this.metrics.nfe.emissoes++;
        
        if (success) {
            this.metrics.nfe.sucessos++;
        } else {
            this.metrics.nfe.erros++;
        }
        
        // Calcular tempo médio de emissão
        const totalTime = (this.metrics.nfe.tempoMedio * (this.metrics.nfe.emissoes - 1)) + responseTime;
        this.metrics.nfe.tempoMedio = totalTime / this.metrics.nfe.emissoes;
    }

    // ==================== ALERTAS E NOTIFICAÇÕES ====================
    
    checkAlerts() {
        const alerts = [];
        
        // CPU alto
        if (this.metrics.system.cpuUsage > 80) {
            alerts.push({
                type: 'HIGH_CPU',
                message: `CPU usage alto: ${this.metrics.system.cpuUsage.toFixed(2)}%`,
                severity: 'warning'
            });
        }
        
        // Memória alta
        if (this.metrics.system.memoryUsage > 85) {
            alerts.push({
                type: 'HIGH_MEMORY',
                message: `Uso de memória alto: ${this.metrics.system.memoryUsage.toFixed(2)}%`,
                severity: 'warning'
            });
        }
        
        // Taxa de erro alta
        const errorRate = (this.metrics.requests.errors / this.metrics.requests.total) * 100;
        if (errorRate > 10) {
            alerts.push({
                type: 'HIGH_ERROR_RATE',
                message: `Taxa de erro alta: ${errorRate.toFixed(2)}%`,
                severity: 'critical'
            });
        }
        
        // Tempo de resposta alto
        if (this.metrics.requests.avgResponseTime > 3000) {
            alerts.push({
                type: 'SLOW_RESPONSE',
                message: `Tempo de resposta alto: ${this.metrics.requests.avgResponseTime.toFixed(0)}ms`,
                severity: 'warning'
            });
        }
        
        // Muitas requisições lentas
        const slowRequestRate = (this.metrics.requests.slowRequests / this.metrics.requests.total) * 100;
        if (slowRequestRate > 5) {
            alerts.push({
                type: 'HIGH_SLOW_REQUESTS',
                message: `Muitas requisições lentas: ${slowRequestRate.toFixed(2)}%`,
                severity: 'warning'
            });
        }
        
        return alerts;
    }

    // ==================== LOGGING ====================
    
    async logSlowRequest(req, responseTime) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'SLOW_REQUEST',
            method: req.method,
            url: req.originalUrl,
            responseTime: responseTime,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        };
        
        await this.writeLog(logEntry);
    }

    async logMetricsIfNeeded() {
        // Log métricas a cada 5 minutos
        const now = Date.now();
        if (!this.lastMetricsLog || (now - this.lastMetricsLog) > 300000) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                type: 'METRICS',
                metrics: { ...this.metrics }
            };
            
            await this.writeLog(logEntry);
            this.lastMetricsLog = now;
        }
    }

    async writeLog(entry) {
        try {
            const logLine = JSON.stringify(entry) + '\n';
            await fs.appendFile(this.logPath, logLine);
        } catch (error) {
            console.error('❌ Erro ao escrever log de performance:', error.message);
        }
    }

    // ==================== RELATÓRIOS ====================
    
    getMetrics() {
        return {
            ...this.metrics,
            alerts: this.checkAlerts(),
            timestamp: new Date().toISOString()
        };
    }

    getHealthStatus() {
        const alerts = this.checkAlerts();
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        
        return {
            status: criticalAlerts.length > 0 ? 'unhealthy' : 'healthy',
            uptime: this.metrics.system.uptime,
            requests: {
                total: this.metrics.requests.total,
                errorRate: (this.metrics.requests.errors / this.metrics.requests.total) * 100,
                avgResponseTime: this.metrics.requests.avgResponseTime
            },
            system: {
                cpu: this.metrics.system.cpuUsage,
                memory: this.metrics.system.memoryUsage
            },
            alerts: alerts.length,
            timestamp: new Date().toISOString()
        };
    }

    async generateReport() {
        const report = {
            period: '24h',
            generated: new Date().toISOString(),
            summary: {
                totalRequests: this.metrics.requests.total,
                successRate: ((this.metrics.requests.success / this.metrics.requests.total) * 100).toFixed(2),
                avgResponseTime: this.metrics.requests.avgResponseTime.toFixed(0),
                nfeEmissions: this.metrics.nfe.emissoes,
                nfeSuccessRate: ((this.metrics.nfe.sucessos / this.metrics.nfe.emissoes) * 100).toFixed(2)
            },
            performance: {
                slowRequests: this.metrics.requests.slowRequests,
                slowRequestRate: ((this.metrics.requests.slowRequests / this.metrics.requests.total) * 100).toFixed(2),
                avgNFeTime: this.metrics.nfe.tempoMedio.toFixed(0)
            },
            system: {
                currentCpu: this.metrics.system.cpuUsage.toFixed(2),
                currentMemory: this.metrics.system.memoryUsage.toFixed(2),
                uptime: Math.floor(this.metrics.system.uptime / 3600) // horas
            },
            alerts: this.checkAlerts()
        };
        
        return report;
    }

    // ==================== RESET E LIMPEZA ====================
    
    resetMetrics() {
        this.metrics = {
            requests: {
                total: 0,
                success: 0,
                errors: 0,
                avgResponseTime: 0,
                slowRequests: 0
            },
            system: {
                cpuUsage: 0,
                memoryUsage: 0,
                diskUsage: 0,
                uptime: 0
            },
            database: {
                connections: 0,
                queries: 0,
                slowQueries: 0,
                errors: 0
            },
            nfe: {
                emissoes: 0,
                sucessos: 0,
                erros: 0,
                tempoMedio: 0
            }
        };
        
        this.responseTimes = [];
        console.log('📊 Métricas de performance resetadas');
    }
}

module.exports = { PerformanceMonitor };