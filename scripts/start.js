/**
 * Script de Start para Produção
 * Inicialização otimizada para Digital Ocean
 */

const cluster = require("cluster");
const os = require("os");
const path = require("path");
const fs = require("fs");

class ProductionStarter {
  constructor() {
    this.config = {
      port: process.env.PORT || 3001,
      workers: process.env.WORKERS || os.cpus().length,
      maxMemory: process.env.MAX_MEMORY || "1G",
      logDir: process.env.LOG_DIR || "/var/log/nfe-backend",
      pidFile: process.env.PID_FILE || "/var/run/nfe-backend.pid",
      gracefulShutdownTimeout:
        parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT) || 30000,
    };

    this.workers = new Map();
    this.isShuttingDown = false;
  }

  /**
   * Iniciar aplicação em modo cluster
   */
  async iniciar() {
    try {
      console.log("🚀 Iniciando NFe Backend em modo produção...");

      // Validações pré-inicialização
      await this.validarAmbiente();

      // Configurar logs
      await this.configurarLogs();

      // Configurar sinais do sistema
      this.configurarSinais();

      if (cluster.isMaster) {
        await this.iniciarMaster();
      } else {
        await this.iniciarWorker();
      }
    } catch (error) {
      console.error("❌ Erro ao iniciar aplicação:", error.message);
      process.exit(1);
    }
  }

  /**
   * Validar ambiente de produção
   */
  async validarAmbiente() {
    console.log("🔍 Validando ambiente de produção...");

    // Verificar Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

    if (majorVersion < 16) {
      throw new Error(`Node.js ${nodeVersion} não suportado. Mínimo: v16.0.0`);
    }

    // Verificar variáveis de ambiente essenciais
    const requiredEnvs = [
      "NODE_ENV",
      "MONGODB_URI",
      "JWT_SECRET",
      "ENCRYPTION_KEY",
    ];

    for (const env of requiredEnvs) {
      if (!process.env[env]) {
        throw new Error(
          `Variável de ambiente obrigatória não definida: ${env}`,
        );
      }
    }

    // Verificar permissões de diretórios
    const dirs = [this.config.logDir, path.dirname(this.config.pidFile)];

    for (const dir of dirs) {
      try {
        await fs.promises.access(dir, fs.constants.W_OK);
      } catch {
        await fs.promises.mkdir(dir, { recursive: true });
      }
    }

    // Verificar porta disponível
    await this.verificarPorta();

    console.log("✅ Ambiente validado");
  }

  /**
   * Verificar se porta está disponível
   */
  async verificarPorta() {
    return new Promise((resolve, reject) => {
      const net = require("net");
      const server = net.createServer();

      server.listen(this.config.port, (err) => {
        if (err) {
          reject(new Error(`Porta ${this.config.port} não disponível`));
        } else {
          server.close(() => resolve());
        }
      });

      server.on("error", (err) => {
        reject(
          new Error(
            `Erro ao verificar porta ${this.config.port}: ${err.message}`,
          ),
        );
      });
    });
  }

  /**
   * Configurar sistema de logs
   */
  async configurarLogs() {
    console.log("📝 Configurando sistema de logs...");

    // Redirecionar stdout e stderr para arquivos
    const logFile = path.join(this.config.logDir, "application.log");
    const errorFile = path.join(this.config.logDir, "error.log");

    // Criar streams de log
    const logStream = fs.createWriteStream(logFile, { flags: "a" });
    const errorStream = fs.createWriteStream(errorFile, { flags: "a" });

    // Interceptar console.log
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] [LOG] ${args.join(" ")}\n`;
      logStream.write(message);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] [ERROR] ${args.join(" ")}\n`;
      errorStream.write(message);
      originalError.apply(console, args);
    };

    // Capturar uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error);
      this.gracefulShutdown(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      this.gracefulShutdown(1);
    });

    console.log("✅ Sistema de logs configurado");
  }

  /**
   * Configurar sinais do sistema
   */
  configurarSinais() {
    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("📡 Recebido SIGTERM, iniciando shutdown graceful...");
      this.gracefulShutdown(0);
    });

    process.on("SIGINT", () => {
      console.log("📡 Recebido SIGINT, iniciando shutdown graceful...");
      this.gracefulShutdown(0);
    });

    // Reload workers
    process.on("SIGUSR2", () => {
      console.log("📡 Recebido SIGUSR2, recarregando workers...");
      this.reloadWorkers();
    });
  }

  /**
   * Iniciar processo master
   */
  async iniciarMaster() {
    console.log(`👑 Processo master iniciado (PID: ${process.pid})`);
    console.log(
      `🔧 Configuração: ${this.config.workers} workers, porta ${this.config.port}`,
    );

    // Salvar PID
    await fs.promises.writeFile(this.config.pidFile, process.pid.toString());

    // Configurar eventos do cluster
    cluster.on("exit", (worker, code, signal) => {
      console.log(`💀 Worker ${worker.process.pid} morreu (${signal || code})`);
      this.workers.delete(worker.id);

      if (!this.isShuttingDown) {
        console.log("🔄 Reiniciando worker...");
        this.criarWorker();
      }
    });

    cluster.on("online", (worker) => {
      console.log(`✅ Worker ${worker.process.pid} online`);
      this.workers.set(worker.id, worker);
    });

    cluster.on("listening", (worker, address) => {
      console.log(
        `🎧 Worker ${worker.process.pid} escutando em ${address.address}:${address.port}`,
      );
    });

    // Criar workers iniciais
    for (let i = 0; i < this.config.workers; i++) {
      this.criarWorker();
    }

    // Iniciar monitoramento
    this.iniciarMonitoramento();

    console.log("🎉 Aplicação iniciada com sucesso!");
  }

  /**
   * Criar novo worker
   */
  criarWorker() {
    const worker = cluster.fork();

    // Configurar timeout para worker
    const timeout = setTimeout(() => {
      console.error(
        `⏰ Worker ${worker.process.pid} não respondeu, matando...`,
      );
      worker.kill();
    }, 30000);

    worker.on("listening", () => {
      clearTimeout(timeout);
    });

    return worker;
  }

  /**
   * Iniciar worker
   */
  async iniciarWorker() {
    console.log(`👷 Worker iniciado (PID: ${process.pid})`);

    // Configurar limite de memória
    if (this.config.maxMemory) {
      const maxMemoryBytes = this.parseMemory(this.config.maxMemory);

      setInterval(() => {
        const usage = process.memoryUsage();
        if (usage.heapUsed > maxMemoryBytes) {
          console.warn(
            `⚠️  Worker ${process.pid} excedeu limite de memória, reiniciando...`,
          );
          process.exit(0);
        }
      }, 60000);
    }

    // Iniciar aplicação
    require("../app.js");
  }

  /**
   * Iniciar monitoramento
   */
  iniciarMonitoramento() {
    console.log("📊 Iniciando monitoramento...");

    // Monitoramento de recursos
    setInterval(() => {
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      console.log(
        `📈 Master - Memória: ${this.formatBytes(usage.heapUsed)}, Workers: ${this.workers.size}`,
      );

      // Verificar workers órfãos
      this.workers.forEach((worker, id) => {
        if (worker.isDead()) {
          console.warn(`💀 Worker órfão detectado: ${id}`);
          this.workers.delete(id);
        }
      });
    }, 60000);

    // Health check periódico
    setInterval(async () => {
      try {
        const HealthCheck = require("./health-check");
        const healthCheck = new HealthCheck();
        const resultado = await healthCheck.executarHealthCheck();

        if (resultado.status !== "healthy") {
          console.warn("⚠️  Health check falhou:", resultado.status);
        }
      } catch (error) {
        console.error("❌ Erro no health check:", error.message);
      }
    }, 300000); // 5 minutos
  }

  /**
   * Recarregar workers
   */
  async reloadWorkers() {
    console.log("🔄 Recarregando workers...");

    const workersArray = Array.from(this.workers.values());

    for (const worker of workersArray) {
      // Criar novo worker
      const newWorker = this.criarWorker();

      // Aguardar novo worker ficar online
      await new Promise((resolve) => {
        newWorker.on("listening", resolve);
      });

      // Matar worker antigo
      worker.kill("SIGTERM");

      // Aguardar um pouco antes do próximo
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("✅ Workers recarregados");
  }

  /**
   * Shutdown graceful
   */
  async gracefulShutdown(exitCode = 0) {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    console.log("🛑 Iniciando shutdown graceful...");

    // Remover PID file
    try {
      await fs.promises.unlink(this.config.pidFile);
    } catch {}

    if (cluster.isMaster) {
      // Parar de aceitar novas conexões
      console.log("🚫 Parando de aceitar novas conexões...");

      // Enviar SIGTERM para todos os workers
      this.workers.forEach((worker) => {
        worker.kill("SIGTERM");
      });

      // Aguardar workers terminarem
      const shutdownTimeout = setTimeout(() => {
        console.log("⏰ Timeout no shutdown, forçando saída...");
        this.workers.forEach((worker) => {
          worker.kill("SIGKILL");
        });
        process.exit(exitCode);
      }, this.config.gracefulShutdownTimeout);

      // Aguardar todos os workers terminarem
      const checkWorkers = setInterval(() => {
        if (this.workers.size === 0) {
          clearTimeout(shutdownTimeout);
          clearInterval(checkWorkers);
          console.log("✅ Shutdown graceful concluído");
          process.exit(exitCode);
        }
      }, 1000);
    } else {
      // Worker shutdown
      console.log(`🛑 Worker ${process.pid} encerrando...`);

      // Fechar servidor HTTP gracefully
      if (global.server) {
        global.server.close(() => {
          console.log(`✅ Worker ${process.pid} encerrado`);
          process.exit(exitCode);
        });
      } else {
        process.exit(exitCode);
      }
    }
  }

  /**
   * Métodos auxiliares
   */
  parseMemory(memStr) {
    const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
    const match = memStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);

    if (!match) {
      throw new Error(`Formato de memória inválido: ${memStr}`);
    }

    const [, size, unit] = match;
    return parseFloat(size) * (units[unit.toUpperCase()] || 1);
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

// Iniciar aplicação se chamado diretamente
if (require.main === module) {
  const starter = new ProductionStarter();
  starter.iniciar().catch((error) => {
    console.error("💥 Falha crítica na inicialização:", error.message);
    process.exit(1);
  });
}

module.exports = ProductionStarter;
