/**
 * Serviço de Gestão de Eventos NFe/CTe/MDFe
 * Cancelamento, Carta de Correção, Devolução, Estorno, Inutilização
 * Validações por UF e prazos específicos
 */

const xml2js = require('xml2js');
const moment = require('moment-timezone');

class GestaoEventosService {
  constructor() {
    // Prazos de cancelamento por UF (em horas)
    this.prazosCancelamento = {
      'AC': 24, 'AL': 24, 'AP': 24, 'AM': 24, 'BA': 24,
      'CE': 24, 'DF': 24, 'ES': 24, 'GO': 24, 'MA': 24,
      'MT': 168, 'MS': 24, 'MG': 24, 'PA': 24, 'PB': 24,
      'PR': 24, 'PE': 24, 'PI': 24, 'RJ': 24, 'RN': 24,
      'RS': 168, 'RO': 24, 'RR': 24, 'SC': 24, 'SP': 24,
      'SE': 24, 'TO': 24
    };

    // Campos permitidos para Carta de Correção
    this.camposPermitidosCCe = [
      'endereco', 'telefone', 'email', 'observacoes',
      'dadosAdicionais', 'informacoesComplementares',
      'transportadora', 'volumes', 'especie', 'marca',
      'numeracao', 'pesoBruto', 'pesoLiquido'
    ];

    // Campos bloqueados para CCe
    this.camposBloqueadosCCe = [
      'chave', 'numero', 'serie', 'dataEmissao', 'cnpj',
      'inscricaoEstadual', 'valorTotal', 'baseCalculoICMS',
      'valorICMS', 'baseCalculoICMSST', 'valorICMSST',
      'valorProdutos', 'valorFrete', 'valorSeguro',
      'valorDesconto', 'valorOutros', 'valorIPI',
      'valorPIS', 'valorCOFINS', 'ncm', 'cst', 'cfop'
    ];

    // Tipos de eventos
    this.tiposEventos = {
      CANCELAMENTO: '110111',
      CCE: '110110',
      CONFIRMACAO_OPERACAO: '210200',
      CIENCIA_OPERACAO: '210210',
      DESCONHECIMENTO_OPERACAO: '210220',
      OPERACAO_NAO_REALIZADA: '210240'
    };
  }

  /**
   * Cancelar NFe
   */
  async cancelarNFe(dados) {
    const { chave, justificativa, usuario, certificado } = dados;

    try {
      // Validar dados básicos
      if (!chave || chave.length !== 44) {
        throw new Error('Chave de acesso inválida');
      }

      if (!justificativa || justificativa.length < 15) {
        throw new Error('Justificativa deve ter pelo menos 15 caracteres');
      }

      if (justificativa.length > 255) {
        throw new Error('Justificativa não pode exceder 255 caracteres');
      }

      // Buscar NFe no banco
      const nfe = await this.buscarNFePorChave(chave);
      if (!nfe) {
        throw new Error('NFe não encontrada');
      }

      if (nfe.situacao === 'cancelada') {
        throw new Error('NFe já está cancelada');
      }

      if (nfe.situacao !== 'autorizada') {
        throw new Error('Apenas NFe autorizadas podem ser canceladas');
      }

      // Validar prazo de cancelamento
      const uf = chave.substring(0, 2);
      const prazoUF = this.prazosCancelamento[uf] || 24;
      const dataEmissao = moment(nfe.dataEmissao);
      const agora = moment();
      const horasDecorridas = agora.diff(dataEmissao, 'hours');

      if (horasDecorridas > prazoUF) {
        throw new Error(`Prazo para cancelamento expirado. UF ${uf}: ${prazoUF}h. Decorridas: ${horasDecorridas}h`);
      }

      // Gerar XML do evento de cancelamento
      const xmlEvento = this.gerarXMLCancelamento({
        chave,
        justificativa,
        sequencia: await this.obterProximaSequenciaEvento(chave),
        ambiente: nfe.ambiente || '2'
      });

      // Assinar XML
      const xmlAssinado = await this.assinarXML(xmlEvento, certificado);

      // Enviar para SEFAZ
      const retorno = await this.enviarEventoSEFAZ(xmlAssinado, uf);

      if (retorno.sucesso) {
        // Atualizar status da NFe
        await this.atualizarStatusNFe(chave, 'cancelada');

        // Registrar evento
        await this.registrarEvento({
          chave,
          tipoEvento: 'cancelamento',
          sequencia: retorno.sequencia,
          dataEvento: new Date(),
          justificativa,
          protocolo: retorno.protocolo,
          usuario: usuario.id,
          xmlEvento: xmlAssinado,
          xmlRetorno: retorno.xmlRetorno
        });

        return {
          sucesso: true,
          protocolo: retorno.protocolo,
          dataEvento: retorno.dataEvento,
          mensagem: 'NFe cancelada com sucesso',
          prazoRestante: `${prazoUF - horasDecorridas}h restantes quando cancelada`
        };
      } else {
        throw new Error(retorno.erro || 'Erro ao cancelar NFe na SEFAZ');
      }

    } catch (error) {
      await this.registrarErroEvento({
        chave,
        tipoEvento: 'cancelamento',
        erro: error.message,
        usuario: usuario?.id
      });
      throw error;
    }
  }

  /**
   * Emitir Carta de Correção Eletrônica (CCe)
   */
  async emitirCCe(dados) {
    const { chave, correcao, usuario, certificado } = dados;

    try {
      // Validar dados básicos
      if (!chave || chave.length !== 44) {
        throw new Error('Chave de acesso inválida');
      }

      if (!correcao || correcao.length < 15) {
        throw new Error('Texto de correção deve ter pelo menos 15 caracteres');
      }

      if (correcao.length > 1000) {
        throw new Error('Texto de correção não pode exceder 1000 caracteres');
      }

      // Buscar NFe
      const nfe = await this.buscarNFePorChave(chave);
      if (!nfe) {
        throw new Error('NFe não encontrada');
      }

      if (nfe.situacao !== 'autorizada') {
        throw new Error('Apenas NFe autorizadas podem receber CCe');
      }

      // Validar se a correção não altera campos bloqueados
      const validacaoCorrecao = this.validarTextoCorrecao(correcao);
      if (!validacaoCorrecao.valido) {
        throw new Error(`Correção inválida: ${validacaoCorrecao.erro}`);
      }

      // Verificar limite de CCe (máximo 20 por NFe)
      const quantidadeCCe = await this.contarCCePorChave(chave);
      if (quantidadeCCe >= 20) {
        throw new Error('Limite máximo de 20 CCe por NFe atingido');
      }

      // Gerar XML da CCe
      const sequencia = await this.obterProximaSequenciaEvento(chave);
      const xmlEvento = this.gerarXMLCCe({
        chave,
        correcao,
        sequencia,
        ambiente: nfe.ambiente || '2'
      });

      // Assinar XML
      const xmlAssinado = await this.assinarXML(xmlEvento, certificado);

      // Enviar para SEFAZ
      const uf = chave.substring(0, 2);
      const retorno = await this.enviarEventoSEFAZ(xmlAssinado, uf);

      if (retorno.sucesso) {
        // Registrar evento
        await this.registrarEvento({
          chave,
          tipoEvento: 'cce',
          sequencia,
          dataEvento: new Date(),
          correcao,
          protocolo: retorno.protocolo,
          usuario: usuario.id,
          xmlEvento: xmlAssinado,
          xmlRetorno: retorno.xmlRetorno
        });

        return {
          sucesso: true,
          protocolo: retorno.protocolo,
          sequencia,
          dataEvento: retorno.dataEvento,
          mensagem: 'CCe registrada com sucesso',
          limiteCCe: `${quantidadeCCe + 1}/20 CCe utilizadas`
        };
      } else {
        throw new Error(retorno.erro || 'Erro ao registrar CCe na SEFAZ');
      }

    } catch (error) {
      await this.registrarErroEvento({
        chave,
        tipoEvento: 'cce',
        erro: error.message,
        usuario: usuario?.id
      });
      throw error;
    }
  }

  /**
   * Processar Devolução de NFe
   */
  async processarDevolucao(dados) {
    const { chaveOriginal, tipoDevolucao = 'total', itens = [], justificativa, usuario } = dados;

    try {
      // Validar NFe original
      const nfeOriginal = await this.buscarNFePorChave(chaveOriginal);
      if (!nfeOriginal) {
        throw new Error('NFe original não encontrada');
      }

      if (nfeOriginal.situacao !== 'autorizada') {
        throw new Error('Apenas NFe autorizadas podem ser devolvidas');
      }

      // Validar prazo para devolução (até 120 dias)
      const dataEmissao = moment(nfeOriginal.dataEmissao);
      const agora = moment();
      const diasDecorridos = agora.diff(dataEmissao, 'days');

      if (diasDecorridos > 120) {
        throw new Error(`Prazo para devolução expirado. Decorridos: ${diasDecorridos} dias (máximo 120)`);
      }

      let dadosDevolucao;

      if (tipoDevolucao === 'total') {
        // Devolução total - todos os itens
        dadosDevolucao = {
          tipo: 'total',
          valorTotal: nfeOriginal.valorTotal,
          itens: nfeOriginal.itens,
          observacoes: `Devolução total da NFe ${nfeOriginal.numero}. ${justificativa}`
        };
      } else {
        // Devolução parcial - itens específicos
        if (!itens || itens.length === 0) {
          throw new Error('Para devolução parcial, é necessário informar os itens');
        }

        const itensValidos = this.validarItensDevolucao(nfeOriginal.itens, itens);
        if (!itensValidos.valido) {
          throw new Error(`Itens inválidos para devolução: ${itensValidos.erro}`);
        }

        dadosDevolucao = {
          tipo: 'parcial',
          valorTotal: itensValidos.valorTotal,
          itens: itensValidos.itens,
          observacoes: `Devolução parcial da NFe ${nfeOriginal.numero}. ${justificativa}`
        };
      }

      // Registrar devolução
      const devolucao = await this.registrarDevolucao({
        chaveOriginal,
        tipoDevolucao,
        dadosDevolucao,
        justificativa,
        usuario: usuario.id,
        dataProcessamento: new Date()
      });

      return {
        sucesso: true,
        idDevolucao: devolucao.id,
        tipo: tipoDevolucao,
        valorDevolvido: dadosDevolucao.valorTotal,
        mensagem: `Devolução ${tipoDevolucao} processada com sucesso`,
        proximosPassos: [
          'Emitir NFe de devolução com CFOP apropriado',
          'Referenciar NFe original no campo de informações adicionais',
          'Ajustar estoque conforme necessário'
        ]
      };

    } catch (error) {
      await this.registrarErroEvento({
        chave: chaveOriginal,
        tipoEvento: 'devolucao',
        erro: error.message,
        usuario: usuario?.id
      });
      throw error;
    }
  }

  /**
   * Processar Estorno de NFe
   */
  async processarEstorno(dados) {
    const { chaveOriginal, tipoEstorno = 'total', motivo, usuario } = dados;

    try {
      // Validar NFe original
      const nfeOriginal = await this.buscarNFePorChave(chaveOriginal);
      if (!nfeOriginal) {
        throw new Error('NFe original não encontrada');
      }

      // Validar prazo para estorno (até 30 dias)
      const dataEmissao = moment(nfeOriginal.dataEmissao);
      const agora = moment();
      const diasDecorridos = agora.diff(dataEmissao, 'days');

      if (diasDecorridos > 30) {
        throw new Error(`Prazo para estorno expirado. Decorridos: ${diasDecorridos} dias (máximo 30)`);
      }

      // Verificar se já existe estorno
      const estornoExistente = await this.buscarEstornoPorChave(chaveOriginal);
      if (estornoExistente) {
        throw new Error('NFe já possui estorno registrado');
      }

      // Registrar estorno
      const estorno = await this.registrarEstorno({
        chaveOriginal,
        tipoEstorno,
        motivo,
        valorEstornado: nfeOriginal.valorTotal,
        usuario: usuario.id,
        dataProcessamento: new Date()
      });

      // Atualizar status da NFe
      await this.atualizarStatusNFe(chaveOriginal, 'estornada');

      return {
        sucesso: true,
        idEstorno: estorno.id,
        tipo: tipoEstorno,
        valorEstornado: nfeOriginal.valorTotal,
        mensagem: 'Estorno processado com sucesso',
        observacoes: [
          'NFe marcada como estornada no sistema',
          'Ajustes contábeis devem ser realizados',
          'Verificar impactos fiscais do estorno'
        ]
      };

    } catch (error) {
      await this.registrarErroEvento({
        chave: chaveOriginal,
        tipoEvento: 'estorno',
        erro: error.message,
        usuario: usuario?.id
      });
      throw error;
    }
  }

  /**
   * Inutilizar Numeração de NFe
   */
  async inutilizarNumeracao(dados) {
    const { serie, numeroInicial, numeroFinal, justificativa, usuario, certificado } = dados;

    try {
      // Validar dados
      if (!serie || serie < 1 || serie > 999) {
        throw new Error('Série deve estar entre 1 e 999');
      }

      if (!numeroInicial || !numeroFinal) {
        throw new Error('Números inicial e final são obrigatórios');
      }

      if (numeroInicial > numeroFinal) {
        throw new Error('Número inicial não pode ser maior que o final');
      }

      if (numeroFinal - numeroInicial > 50) {
        throw new Error('Máximo de 50 números por inutilização');
      }

      if (!justificativa || justificativa.length < 15) {
        throw new Error('Justificativa deve ter pelo menos 15 caracteres');
      }

      // Verificar se a numeração já foi utilizada
      const numeracaoUtilizada = await this.verificarNumeracaoUtilizada(serie, numeroInicial, numeroFinal);
      if (numeracaoUtilizada.length > 0) {
        throw new Error(`Números já utilizados: ${numeracaoUtilizada.join(', ')}`);
      }

      // Verificar se já foi inutilizada
      const jaInutilizada = await this.verificarNumeracaoInutilizada(serie, numeroInicial, numeroFinal);
      if (jaInutilizada.length > 0) {
        throw new Error(`Números já inutilizados: ${jaInutilizada.join(', ')}`);
      }

      // Gerar XML de inutilização
      const xmlInutilizacao = this.gerarXMLInutilizacao({
        serie,
        numeroInicial,
        numeroFinal,
        justificativa,
        ambiente: '2' // Sempre homologação primeiro
      });

      // Assinar XML
      const xmlAssinado = await this.assinarXML(xmlInutilizacao, certificado);

      // Enviar para SEFAZ
      const retorno = await this.enviarInutilizacaoSEFAZ(xmlAssinado);

      if (retorno.sucesso) {
        // Registrar inutilização
        await this.registrarInutilizacao({
          serie,
          numeroInicial,
          numeroFinal,
          justificativa,
          protocolo: retorno.protocolo,
          usuario: usuario.id,
          dataInutilizacao: new Date(),
          xmlInutilizacao: xmlAssinado,
          xmlRetorno: retorno.xmlRetorno
        });

        return {
          sucesso: true,
          protocolo: retorno.protocolo,
          serie,
          faixa: `${numeroInicial} a ${numeroFinal}`,
          quantidade: numeroFinal - numeroInicial + 1,
          mensagem: 'Numeração inutilizada com sucesso'
        };
      } else {
        throw new Error(retorno.erro || 'Erro ao inutilizar numeração na SEFAZ');
      }

    } catch (error) {
      await this.registrarErroEvento({
        tipoEvento: 'inutilizacao',
        erro: error.message,
        dados: { serie, numeroInicial, numeroFinal },
        usuario: usuario?.id
      });
      throw error;
    }
  }

  /**
   * Consultar Histórico de Eventos
   */
  async consultarHistoricoEventos(filtros) {
    const { chave, tipoEvento, dataInicial, dataFinal, usuario, limite = 50, pagina = 1 } = filtros;

    try {
      const eventos = await this.buscarEventos({
        chave,
        tipoEvento,
        dataInicial,
        dataFinal,
        usuario,
        limite,
        offset: (pagina - 1) * limite
      });

      const total = await this.contarEventos({
        chave,
        tipoEvento,
        dataInicial,
        dataFinal,
        usuario
      });

      return {
        sucesso: true,
        eventos: eventos.map(evento => ({
          id: evento.id,
          chave: evento.chave,
          tipoEvento: evento.tipoEvento,
          dataEvento: evento.dataEvento,
          protocolo: evento.protocolo,
          status: evento.status,
          justificativa: evento.justificativa || evento.correcao,
          usuario: evento.usuario,
          observacoes: evento.observacoes
        })),
        paginacao: {
          pagina,
          limite,
          total,
          totalPaginas: Math.ceil(total / limite)
        }
      };

    } catch (error) {
      throw new Error(`Erro ao consultar histórico: ${error.message}`);
    }
  }

  /**
   * Consultar Prazos de Cancelamento por UF
   */
  consultarPrazosCancelamento() {
    return {
      sucesso: true,
      prazos: Object.entries(this.prazosCancelamento).map(([uf, prazo]) => ({
        uf,
        prazo: `${prazo}h`,
        descricao: prazo === 168 ? '7 dias (168 horas)' : '24 horas'
      })),
      observacoes: [
        'Prazos contados a partir da data/hora de emissão da NFe',
        'Alguns estados podem ter prazos diferenciados',
        'Verificar sempre a legislação local atualizada'
      ]
    };
  }

  /**
   * Métodos auxiliares privados
   */
  async buscarNFePorChave(chave) {
    // Implementar busca no banco de dados
    // Retorna dados da NFe ou null se não encontrada
  }

  async obterProximaSequenciaEvento(chave) {
    // Implementar busca da próxima sequência de evento para a chave
    // Retorna número sequencial (1, 2, 3...)
  }

  gerarXMLCancelamento(dados) {
    // Implementar geração do XML de cancelamento
    // Retorna XML formatado para envio à SEFAZ
  }

  gerarXMLCCe(dados) {
    // Implementar geração do XML de CCe
    // Retorna XML formatado para envio à SEFAZ
  }

  gerarXMLInutilizacao(dados) {
    // Implementar geração do XML de inutilização
    // Retorna XML formatado para envio à SEFAZ
  }

  async assinarXML(xml, certificado) {
    // Implementar assinatura digital do XML
    // Retorna XML assinado
  }

  async enviarEventoSEFAZ(xml, uf) {
    // Implementar envio do evento para SEFAZ
    // Retorna resultado do processamento
  }

  async enviarInutilizacaoSEFAZ(xml) {
    // Implementar envio da inutilização para SEFAZ
    // Retorna resultado do processamento
  }

  validarTextoCorrecao(texto) {
    // Implementar validação do texto de correção
    // Verifica se não altera campos bloqueados
    const camposBloqueados = this.camposBloqueadosCCe.some(campo => 
      texto.toLowerCase().includes(campo.toLowerCase())
    );

    if (camposBloqueados) {
      return {
        valido: false,
        erro: 'Texto de correção não pode alterar campos bloqueados (valores, impostos, identificação)'
      };
    }

    return { valido: true };
  }

  async registrarEvento(dados) {
    // Implementar registro do evento no banco de dados
  }

  async registrarErroEvento(dados) {
    // Implementar registro de erro no banco de dados
  }

  async atualizarStatusNFe(chave, novoStatus) {
    // Implementar atualização do status da NFe
  }
}

module.exports = GestaoEventosService;