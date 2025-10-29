const fs = require('fs');
const path = require('path');

class LogService {
  constructor() {
    this.LOGS_DIR = path.join(__dirname, '../logs');
    this.LOG_FILE = path.join(this.LOGS_DIR, 'nfe-operations.log');
    this.ERROR_FILE = path.join(this.LOGS_DIR, 'nfe-errors.log');
    this.AUDIT_FILE = path.join(this.LOGS_DIR, 'nfe-audit.log');
    
    // Cria diretório de logs se não existir
    this.criarDiretorioLogs();
  }

  criarDiretorioLogs() {
    if (!fs.existsSync(this.LOGS_DIR)) {
      fs.mkdirSync(this.LOGS_DIR, { recursive: true });
    }
  }

  // ==================== LOG PRINCIPAL ====================

  async log(operacao, tipo, dados = {}) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        operacao,
        tipo,
        dados: this.sanitizarDados(dados),
        ip: dados.ip || 'localhost',
        userAgent: dados.userAgent || 'backend-service'
      };

      // Log geral
      await this.escreverLog(this.LOG_FILE, logEntry);

      // Log de auditoria para operações críticas
      if (this.isOperacaoCritica(operacao)) {
        await this.escreverLog(this.AUDIT_FILE, logEntry);
      }

      // Log de erro se necessário
      if (tipo === 'ERRO') {
        await this.escreverLog(this.ERROR_FILE, logEntry);
      }

      console.log(`[LOG] ${operacao}:${tipo} - ${timestamp}`);

    } catch (error) {
      console.error('Erro ao escrever log:', error);
    }
  }

  // ==================== LOGS ESPECÍFICOS ====================

  async logEmissao(dados, resultado) {
    await this.log('emissao', resultado.sucesso ? 'SUCESSO' : 'ERRO', {
      numero: dados.numero,
      serie: dados.serie,
      valorTotal: dados.totais?.valorTotal,
      destinatario: dados.destinatario?.nome,
      chave: resultado.chave,
      protocolo: resultado.protocolo,
      erro: resultado.erro
    });
  }

  async logConsulta(chave, resultado) {
    await this.log('consulta', 'SUCESSO', {
      chave,
      situacao: resultado.situacao,
      protocolo: resultado.protocolo
    });
  }

  async logCancelamento(chave, justificativa, resultado) {
    await this.log('cancelamento', resultado.sucesso ? 'SUCESSO' : 'ERRO', {
      chave,
      justificativa,
      protocolo: resultado.protocolo,
      erro: resultado.erro
    });
  }

  async logValidacao(dados, resultado) {
    await this.log('validacao', resultado.valido ? 'SUCESSO' : 'AVISO', {
      numero: dados.numero,
      valido: resultado.valido,
      erros: resultado.erros?.length || 0,
      avisos: resultado.avisos?.length || 0
    });
  }

  async logAcesso(endpoint, metodo, ip, userAgent) {
    await this.log('acesso', 'INFO', {
      endpoint,
      metodo,
      ip,
      userAgent
    });
  }

  async logErro(operacao, erro, contexto = {}) {
    await this.log(operacao, 'ERRO', {
      erro: erro.message,
      stack: erro.stack,
      contexto
    });
  }

  // ==================== RELATÓRIOS ====================

  async gerarRelatorioOperacoes(dataInicio, dataFim) {
    try {
      const logs = await this.lerLogs(this.LOG_FILE, dataInicio, dataFim);
      
      const relatorio = {
        periodo: { dataInicio, dataFim },
        totalOperacoes: logs.length,
        operacoesPorTipo: this.contarOperacoesPorTipo(logs),
        sucessos: logs.filter(log => log.tipo === 'SUCESSO').length,
        erros: logs.filter(log => log.tipo === 'ERRO').length,
        operacoesPorHora: this.agruparPorHora(logs),
        topErros: this.obterTopErros(logs)
      };

      return relatorio;
    } catch (error) {
      throw new Error(`Erro ao gerar relatório: ${error.message}`);
    }
  }

  async gerarRelatorioErros(dataInicio, dataFim) {
    try {
      const logs = await this.lerLogs(this.ERROR_FILE, dataInicio, dataFim);
      
      return {
        periodo: { dataInicio, dataFim },
        totalErros: logs.length,
        errosPorOperacao: this.contarOperacoesPorTipo(logs),
        errosPorHora: this.agruparPorHora(logs),
        detalhesErros: logs.map(log => ({
          timestamp: log.timestamp,
          operacao: log.operacao,
          erro: log.dados.erro,
          contexto: log.dados.contexto
        }))
      };
    } catch (error) {
      throw new Error(`Erro ao gerar relatório de erros: ${error.message}`);
    }
  }

  async obterLogsRecentes(limite = 100) {
    try {
      const logs = await this.lerLogs(this.LOG_FILE);
      return logs.slice(-limite).reverse(); // Últimos logs, mais recentes primeiro
    } catch (error) {
      throw new Error(`Erro ao obter logs recentes: ${error.message}`);
    }
  }

  // ==================== LIMPEZA DE LOGS ====================

  async limparLogsAntigos(diasParaManter = 30) {
    try {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasParaManter);

      const arquivos = [this.LOG_FILE, this.ERROR_FILE, this.AUDIT_FILE];
      
      for (const arquivo of arquivos) {
        if (fs.existsSync(arquivo)) {
          await this.limparArquivoLog(arquivo, dataLimite);
        }
      }

      await this.log('limpeza', 'SUCESSO', { 
        diasParaManter, 
        dataLimite: dataLimite.toISOString() 
      });

    } catch (error) {
      await this.log('limpeza', 'ERRO', { erro: error.message });
      throw error;
    }
  }

  async limparArquivoLog(arquivo, dataLimite) {
    const logs = await this.lerLogs(arquivo);
    const logsParaManter = logs.filter(log => {
      const dataLog = new Date(log.timestamp);
      return dataLog >= dataLimite;
    });

    // Reescreve o arquivo apenas com logs recentes
    const conteudo = logsParaManter.map(log => JSON.stringify(log)).join('\n');
    fs.writeFileSync(arquivo, conteudo, 'utf-8');
  }

  // ==================== MONITORAMENTO ====================

  async obterEstatisticas() {
    try {
      const agora = new Date();
      const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const inicioSemana = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

      const logsHoje = await this.lerLogs(this.LOG_FILE, inicioHoje.toISOString());
      const logsSemana = await this.lerLogs(this.LOG_FILE, inicioSemana.toISOString());
      const errosHoje = await this.lerLogs(this.ERROR_FILE, inicioHoje.toISOString());

      return {
        hoje: {
          totalOperacoes: logsHoje.length,
          sucessos: logsHoje.filter(log => log.tipo === 'SUCESSO').length,
          erros: errosHoje.length,
          operacoesPorTipo: this.contarOperacoesPorTipo(logsHoje)
        },
        semana: {
          totalOperacoes: logsSemana.length,
          sucessos: logsSemana.filter(log => log.tipo === 'SUCESSO').length,
          mediaOperacoesPorDia: Math.round(logsSemana.length / 7)
        },
        sistema: {
          tamanhoLogPrincipal: this.obterTamanhoArquivo(this.LOG_FILE),
          tamanhoLogErros: this.obterTamanhoArquivo(this.ERROR_FILE),
          ultimaOperacao: logsHoje.length > 0 ? logsHoje[logsHoje.length - 1].timestamp : null
        }
      };
    } catch (error) {
      throw new Error(`Erro ao obter estatísticas: ${error.message}`);
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  async escreverLog(arquivo, logEntry) {
    const linha = JSON.stringify(logEntry) + '\n';
    
    return new Promise((resolve, reject) => {
      fs.appendFile(arquivo, linha, 'utf-8', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async lerLogs(arquivo, dataInicio, dataFim) {
    if (!fs.existsSync(arquivo)) {
      return [];
    }

    const conteudo = fs.readFileSync(arquivo, 'utf-8');
    const linhas = conteudo.trim().split('\n').filter(linha => linha.trim());
    
    let logs = linhas.map(linha => {
      try {
        return JSON.parse(linha);
      } catch {
        return null;
      }
    }).filter(log => log !== null);

    // Filtra por período se especificado
    if (dataInicio) {
      const inicio = new Date(dataInicio);
      logs = logs.filter(log => new Date(log.timestamp) >= inicio);
    }

    if (dataFim) {
      const fim = new Date(dataFim);
      logs = logs.filter(log => new Date(log.timestamp) <= fim);
    }

    return logs;
  }

  sanitizarDados(dados) {
    // Remove dados sensíveis dos logs
    const dadosLimpos = { ...dados };
    
    // Remove senhas, tokens, etc.
    const camposSensiveis = ['senha', 'password', 'token', 'certificado', 'chavePrivada'];
    camposSensiveis.forEach(campo => {
      if (dadosLimpos[campo]) {
        dadosLimpos[campo] = '[REMOVIDO]';
      }
    });

    // Limita tamanho de campos grandes
    Object.keys(dadosLimpos).forEach(chave => {
      if (typeof dadosLimpos[chave] === 'string' && dadosLimpos[chave].length > 1000) {
        dadosLimpos[chave] = dadosLimpos[chave].substring(0, 1000) + '... [TRUNCADO]';
      }
    });

    return dadosLimpos;
  }

  isOperacaoCritica(operacao) {
    const operacoesCriticas = ['emissao', 'cancelamento', 'autenticacao'];
    return operacoesCriticas.includes(operacao);
  }

  contarOperacoesPorTipo(logs) {
    const contadores = {};
    logs.forEach(log => {
      const chave = log.operacao;
      contadores[chave] = (contadores[chave] || 0) + 1;
    });
    return contadores;
  }

  agruparPorHora(logs) {
    const grupos = {};
    logs.forEach(log => {
      const hora = new Date(log.timestamp).getHours();
      grupos[hora] = (grupos[hora] || 0) + 1;
    });
    return grupos;
  }

  obterTopErros(logs) {
    const erros = logs.filter(log => log.tipo === 'ERRO');
    const contadores = {};
    
    erros.forEach(log => {
      const erro = log.dados.erro || 'Erro desconhecido';
      contadores[erro] = (contadores[erro] || 0) + 1;
    });

    return Object.entries(contadores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([erro, count]) => ({ erro, count }));
  }

  obterTamanhoArquivo(arquivo) {
    try {
      if (fs.existsSync(arquivo)) {
        const stats = fs.statSync(arquivo);
        return this.formatarTamanho(stats.size);
      }
      return '0 B';
    } catch {
      return 'N/A';
    }
  }

  formatarTamanho(bytes) {
    const unidades = ['B', 'KB', 'MB', 'GB'];
    let tamanho = bytes;
    let unidadeIndex = 0;

    while (tamanho >= 1024 && unidadeIndex < unidades.length - 1) {
      tamanho /= 1024;
      unidadeIndex++;
    }

    return `${tamanho.toFixed(1)} ${unidades[unidadeIndex]}`;
  }
}

module.exports = new LogService();