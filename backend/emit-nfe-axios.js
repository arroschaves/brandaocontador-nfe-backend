// Stub de EmissorNFeAxios para modo simulação/local
// Evita erro MODULE_NOT_FOUND e fornece respostas simuladas

class EmissorNFeAxios {
  constructor(options = {}) {
    this.options = options;
    this.inicializado = false;
  }

  async inicializar() {
    // Simula inicialização de clientes/recursos
    this.inicializado = true;
    return true;
  }

  async consultarNFe(chave) {
    if (!this.inicializado) await this.inicializar();
    const situacoes = ['Autorizada', 'Cancelada', 'Denegada'];
    const situacao = situacoes[Math.floor(Math.random() * situacoes.length)];
    return {
      chave,
      situacao,
      protocolo: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
      dataHora: new Date().toISOString(),
      motivo: situacao === 'Autorizada' ? 'Autorizado o uso da NF-e' : 
              situacao === 'Cancelada' ? 'Cancelamento de NF-e homologado' :
              'Uso Denegado'
    };
  }

  async cancelarNFe(chave, justificativa) {
    if (!this.inicializado) await this.inicializar();
    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter pelo menos 15 caracteres');
    }
    return {
      chave,
      situacao: 'Cancelada',
      protocolo: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
      dataHora: new Date().toISOString(),
      motivo: 'Cancelamento de NF-e homologado',
      justificativa
    };
  }
}

module.exports = { EmissorNFeAxios };