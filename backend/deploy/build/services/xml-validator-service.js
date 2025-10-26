/**
 * Serviço de Validação XML NFe 4.0
 * Implementa validações conforme legislação SEFAZ 2025
 * Baseado na NT 2025.002 e Manual de Orientação do Contribuinte v7.00
 */

const fs = require('fs');
const path = require('path');

class XmlValidatorService {
  constructor() {
    // Códigos UF conforme tabela IBGE
    this.codigosUF = {
      'AC': '12', 'AL': '17', 'AP': '16', 'AM': '13', 'BA': '29',
      'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
      'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25',
      'PR': '41', 'PE': '26', 'PI': '22', 'RJ': '33', 'RN': '24',
      'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35',
      'SE': '28', 'TO': '17'
    };

    // CSTs válidos para ICMS
    this.cstsICMS = [
      '00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90'
    ];

    // CSTs válidos para IPI
    this.cstsIPI = [
      '00', '01', '02', '03', '04', '05', '49', '50', '51', '52', '53', '54', '55', '99'
    ];

    // CSTs válidos para PIS
    this.cstsPIS = [
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '49', '50', '51', '52', '53', '54', '55', '56', '60', '61', '62', '63', '64', '65', '66', '67', '70', '71', '72', '73', '74', '75', '98', '99'
    ];

    // CSTs válidos para COFINS
    this.cstsCOFINS = [
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '49', '50', '51', '52', '53', '54', '55', '56', '60', '61', '62', '63', '64', '65', '66', '67', '70', '71', '72', '73', '74', '75', '98', '99'
    ];

    // Campos obrigatórios NFe 4.0
    this.camposObrigatorios = {
      ide: ['cUF', 'cNF', 'natOp', 'mod', 'serie', 'nNF', 'dhEmi', 'tpNF', 'idDest', 'cMunFG', 'tpImp', 'tpEmis', 'cDV', 'tpAmb', 'finNFe', 'indFinal', 'indPres', 'procEmi', 'verProc'],
      emit: ['CNPJ', 'xNome', 'enderEmit', 'IE', 'CRT'],
      enderEmit: ['xLgr', 'nro', 'xBairro', 'cMun', 'xMun', 'UF', 'CEP', 'cPais', 'xPais'],
      dest: ['xNome', 'enderDest', 'indIEDest'],
      enderDest: ['xLgr', 'nro', 'xBairro', 'cMun', 'xMun', 'UF', 'CEP', 'cPais', 'xPais'],
      prod: ['cProd', 'cEAN', 'xProd', 'NCM', 'CFOP', 'uCom', 'qCom', 'vUnCom', 'vProd', 'cEANTrib', 'uTrib', 'qTrib', 'vUnTrib', 'indTot'],
      imposto: ['vTotTrib'],
      total: ['ICMSTot']
    };

    this.erros = [];
    this.avisos = [];
  }

  /**
   * Valida XML NFe 4.0 completo
   */
  validarXmlNfe(xmlContent, dadosNfe) {
    this.erros = [];
    this.avisos = [];

    try {
      // Validações estruturais básicas
      this.validarEstruturaNfe(xmlContent);
      
      // Validações de dados
      this.validarDadosNfe(dadosNfe);
      
      // Validações específicas NFe 4.0
      this.validarNfe40(dadosNfe);
      
      // Validações tributárias
      this.validarTributacao(dadosNfe);
      
      // Validações de conformidade SEFAZ
      this.validarConformidadeSefaz(dadosNfe);

      return {
        valido: this.erros.length === 0,
        erros: this.erros,
        avisos: this.avisos
      };

    } catch (error) {
      this.erros.push(`Erro na validação: ${error.message}`);
      return {
        valido: false,
        erros: this.erros,
        avisos: this.avisos
      };
    }
  }

  /**
   * Valida estrutura básica do XML NFe
   */
  validarEstruturaNfe(xmlContent) {
    // Verifica se é XML válido
    if (!xmlContent || typeof xmlContent !== 'string') {
      this.erros.push('XML inválido ou vazio');
      return;
    }

    // Verifica namespace NFe
    if (!xmlContent.includes('xmlns="http://www.portalfiscal.inf.br/nfe"')) {
      this.erros.push('Namespace NFe não encontrado ou incorreto');
    }

    // Verifica versão 4.00
    if (!xmlContent.includes('versao="4.00"')) {
      this.erros.push('Versão do layout deve ser 4.00');
    }

    // Verifica estrutura básica
    const estruturasObrigatorias = ['<NFe', '<infNFe', '<ide>', '<emit>', '<total>'];
    estruturasObrigatorias.forEach(estrutura => {
      if (!xmlContent.includes(estrutura)) {
        this.erros.push(`Estrutura obrigatória não encontrada: ${estrutura}`);
      }
    });
  }

  /**
   * Valida dados da NFe conforme regras de negócio
   */
  validarDadosNfe(dados) {
    // Validar identificação
    this.validarIdentificacao(dados);
    
    // Validar emitente
    this.validarEmitente(dados.emitente);
    
    // Validar destinatário
    this.validarDestinatario(dados.destinatario);
    
    // Validar itens
    this.validarItens(dados.itens);
    
    // Validar totais
    this.validarTotais(dados.totais);
  }

  /**
   * Valida identificação da NFe
   */
  validarIdentificacao(dados) {
    // Série deve estar entre 1 e 999
    if (!dados.serie || dados.serie < 1 || dados.serie > 999) {
      this.erros.push('Série deve estar entre 1 e 999');
    }

    // Número deve estar entre 1 e 999999999
    if (!dados.numero || dados.numero < 1 || dados.numero > 999999999) {
      this.erros.push('Número da NFe deve estar entre 1 e 999999999');
    }

    // Natureza da operação é obrigatória
    if (!dados.naturezaOperacao || dados.naturezaOperacao.trim().length === 0) {
      this.erros.push('Natureza da operação é obrigatória');
    }

    // Código do município deve ter 7 dígitos
    if (!dados.codigoMunicipio || !/^\d{7}$/.test(dados.codigoMunicipio)) {
      this.erros.push('Código do município deve ter 7 dígitos');
    }
  }

  /**
   * Valida dados do emitente
   */
  validarEmitente(emitente) {
    if (!emitente) {
      this.erros.push('Dados do emitente são obrigatórios');
      return;
    }

    // CNPJ obrigatório e válido
    if (!emitente.cnpj || !this.validarCNPJ(emitente.cnpj)) {
      this.erros.push('CNPJ do emitente inválido');
    }

    // Nome/Razão Social obrigatório
    if (!emitente.nome && !emitente.razaoSocial) {
      this.erros.push('Nome ou Razão Social do emitente é obrigatório');
    }

    // Inscrição Estadual obrigatória
    if (!emitente.inscricaoEstadual) {
      this.erros.push('Inscrição Estadual do emitente é obrigatória');
    }

    // Validar endereço do emitente
    this.validarEndereco(emitente.endereco, 'emitente');

    // Regime tributário válido (1=Simples Nacional, 2=Simples Nacional - excesso, 3=Regime Normal)
    if (!emitente.regimeTributario || ![1, 2, 3].includes(emitente.regimeTributario)) {
      this.erros.push('Regime tributário do emitente deve ser 1, 2 ou 3');
    }
  }

  /**
   * Valida dados do destinatário
   */
  validarDestinatario(destinatario) {
    if (!destinatario) {
      this.erros.push('Dados do destinatário são obrigatórios');
      return;
    }

    // CNPJ ou CPF obrigatório
    if (!destinatario.cnpj && !destinatario.cpf) {
      this.erros.push('CNPJ ou CPF do destinatário é obrigatório');
    }

    if (destinatario.cnpj && !this.validarCNPJ(destinatario.cnpj)) {
      this.erros.push('CNPJ do destinatário inválido');
    }

    if (destinatario.cpf && !this.validarCPF(destinatario.cpf)) {
      this.erros.push('CPF do destinatário inválido');
    }

    // Nome obrigatório
    if (!destinatario.nome || destinatario.nome.trim().length === 0) {
      this.erros.push('Nome do destinatário é obrigatório');
    }

    // Validar endereço do destinatário
    this.validarEndereco(destinatario.endereco, 'destinatário');
  }

  /**
   * Valida endereço
   */
  validarEndereco(endereco, tipo) {
    if (!endereco) {
      this.erros.push(`Endereço do ${tipo} é obrigatório`);
      return;
    }

    const camposObrigatorios = ['logradouro', 'numero', 'bairro', 'municipio', 'uf', 'cep'];
    camposObrigatorios.forEach(campo => {
      if (!endereco[campo] || endereco[campo].toString().trim().length === 0) {
        this.erros.push(`${campo} do endereço do ${tipo} é obrigatório`);
      }
    });

    // Validar UF
    if (endereco.uf && !this.codigosUF[endereco.uf]) {
      this.erros.push(`UF inválida no endereço do ${tipo}: ${endereco.uf}`);
    }

    // Validar CEP
    if (endereco.cep && !/^\d{8}$/.test(endereco.cep.replace(/\D/g, ''))) {
      this.erros.push(`CEP inválido no endereço do ${tipo}`);
    }

    // Código do município obrigatório
    if (!endereco.codigoMunicipio || !/^\d{7}$/.test(endereco.codigoMunicipio)) {
      this.erros.push(`Código do município inválido no endereço do ${tipo}`);
    }
  }

  /**
   * Valida itens da NFe
   */
  validarItens(itens) {
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      this.erros.push('NFe deve conter pelo menos um item');
      return;
    }

    itens.forEach((item, index) => {
      const numeroItem = index + 1;

      // Campos obrigatórios do produto
      if (!item.codigo || item.codigo.trim().length === 0) {
        this.erros.push(`Código do produto é obrigatório no item ${numeroItem}`);
      }

      if (!item.descricao || item.descricao.trim().length === 0) {
        this.erros.push(`Descrição do produto é obrigatória no item ${numeroItem}`);
      }

      if (!item.ncm || !/^\d{8}$/.test(item.ncm)) {
        this.erros.push(`NCM deve ter 8 dígitos no item ${numeroItem}`);
      }

      if (!item.cfop || !/^\d{4}$/.test(item.cfop)) {
        this.erros.push(`CFOP deve ter 4 dígitos no item ${numeroItem}`);
      }

      if (!item.unidade || item.unidade.trim().length === 0) {
        this.erros.push(`Unidade é obrigatória no item ${numeroItem}`);
      }

      if (!item.quantidade || item.quantidade <= 0) {
        this.erros.push(`Quantidade deve ser maior que zero no item ${numeroItem}`);
      }

      if (!item.valorUnitario || item.valorUnitario <= 0) {
        this.erros.push(`Valor unitário deve ser maior que zero no item ${numeroItem}`);
      }

      // Validar tributação do item
      this.validarTributacaoItem(item, numeroItem);
    });
  }

  /**
   * Valida tributação de um item
   */
  validarTributacaoItem(item, numeroItem) {
    if (!item.tributacao) {
      this.avisos.push(`Tributação não informada para o item ${numeroItem}`);
      return;
    }

    const { tributacao } = item;

    // Validar ICMS
    if (tributacao.icms) {
      if (!this.cstsICMS.includes(tributacao.icms.cst)) {
        this.erros.push(`CST do ICMS inválido no item ${numeroItem}: ${tributacao.icms.cst}`);
      }

      if (tributacao.icms.valor > 0) {
        if (!tributacao.icms.baseCalculo || tributacao.icms.baseCalculo <= 0) {
          this.erros.push(`Base de cálculo do ICMS obrigatória quando há valor no item ${numeroItem}`);
        }

        if (!tributacao.icms.aliquota || tributacao.icms.aliquota < 0) {
          this.erros.push(`Alíquota do ICMS inválida no item ${numeroItem}`);
        }
      }
    }

    // Validar IPI
    if (tributacao.ipi) {
      if (!this.cstsIPI.includes(tributacao.ipi.cst)) {
        this.erros.push(`CST do IPI inválido no item ${numeroItem}: ${tributacao.ipi.cst}`);
      }
    }

    // Validar PIS
    if (tributacao.pis) {
      if (!this.cstsPIS.includes(tributacao.pis.cst)) {
        this.erros.push(`CST do PIS inválido no item ${numeroItem}: ${tributacao.pis.cst}`);
      }
    }

    // Validar COFINS
    if (tributacao.cofins) {
      if (!this.cstsCOFINS.includes(tributacao.cofins.cst)) {
        this.erros.push(`CST do COFINS inválido no item ${numeroItem}: ${tributacao.cofins.cst}`);
      }
    }
  }

  /**
   * Valida totais da NFe
   */
  validarTotais(totais) {
    if (!totais) {
      this.erros.push('Totais da NFe são obrigatórios');
      return;
    }

    // Valor total dos produtos deve ser maior que zero
    if (!totais.vProd || totais.vProd <= 0) {
      this.erros.push('Valor total dos produtos deve ser maior que zero');
    }

    // Valor total da NFe deve ser maior que zero
    if (!totais.vNF || totais.vNF <= 0) {
      this.erros.push('Valor total da NFe deve ser maior que zero');
    }

    // Valor total de tributos deve ser informado
    if (totais.vTotTrib === undefined || totais.vTotTrib < 0) {
      this.erros.push('Valor total de tributos deve ser informado');
    }
  }

  /**
   * Validações específicas NFe 4.0
   */
  validarNfe40(dados) {
    // Indicador de destinatário obrigatório
    if (dados.destinatario) {
      if (dados.destinatario.cnpj) {
        // Para CNPJ, indicador deve ser 1 (Contribuinte ICMS)
        if (!dados.destinatario.indicadorIE || ![1, 2, 9].includes(dados.destinatario.indicadorIE)) {
          this.avisos.push('Indicador de IE do destinatário deve ser informado para CNPJ');
        }
      } else if (dados.destinatario.cpf) {
        // Para CPF, indicador deve ser 9 (Não Contribuinte)
        if (dados.destinatario.indicadorIE !== 9) {
          this.avisos.push('Para CPF, indicador de IE deve ser 9 (Não Contribuinte)');
        }
      }
    }

    // Indicador de presença obrigatório
    if (!dados.indicadorPresenca || ![0, 1, 2, 3, 4, 5, 9].includes(dados.indicadorPresenca)) {
      this.avisos.push('Indicador de presença deve ser informado (0 a 5 ou 9)');
    }

    // Indicador de consumidor final obrigatório
    if (!dados.indicadorFinal || ![0, 1].includes(dados.indicadorFinal)) {
      this.avisos.push('Indicador de consumidor final deve ser 0 ou 1');
    }
  }

  /**
   * Valida tributação geral
   */
  validarTributacao(dados) {
    if (!dados.itens || dados.itens.length === 0) return;

    let totalICMS = 0;
    let totalIPI = 0;
    let totalPIS = 0;
    let totalCOFINS = 0;
    let totalTributos = 0;

    dados.itens.forEach((item, index) => {
      if (item.tributacao) {
        totalICMS += item.tributacao.icms?.valor || 0;
        totalIPI += item.tributacao.ipi?.valor || 0;
        totalPIS += item.tributacao.pis?.valor || 0;
        totalCOFINS += item.tributacao.cofins?.valor || 0;
        totalTributos += (
          (item.tributacao.icms?.valor || 0) +
          (item.tributacao.ipi?.valor || 0) +
          (item.tributacao.pis?.valor || 0) +
          (item.tributacao.cofins?.valor || 0) +
          (item.tributacao.iss?.valor || 0)
        );
      }
    });

    // Verificar se os totais batem
    if (dados.totais) {
      const tolerancia = 0.01; // Tolerância de 1 centavo

      if (Math.abs((dados.totais.vICMS || 0) - totalICMS) > tolerancia) {
        this.erros.push(`Total de ICMS divergente. Calculado: ${totalICMS.toFixed(2)}, Informado: ${(dados.totais.vICMS || 0).toFixed(2)}`);
      }

      if (Math.abs((dados.totais.vIPI || 0) - totalIPI) > tolerancia) {
        this.erros.push(`Total de IPI divergente. Calculado: ${totalIPI.toFixed(2)}, Informado: ${(dados.totais.vIPI || 0).toFixed(2)}`);
      }

      if (Math.abs((dados.totais.vPIS || 0) - totalPIS) > tolerancia) {
        this.erros.push(`Total de PIS divergente. Calculado: ${totalPIS.toFixed(2)}, Informado: ${(dados.totais.vPIS || 0).toFixed(2)}`);
      }

      if (Math.abs((dados.totais.vCOFINS || 0) - totalCOFINS) > tolerancia) {
        this.erros.push(`Total de COFINS divergente. Calculado: ${totalCOFINS.toFixed(2)}, Informado: ${(dados.totais.vCOFINS || 0).toFixed(2)}`);
      }

      if (Math.abs((dados.totais.vTotTrib || 0) - totalTributos) > tolerancia) {
        this.erros.push(`Total de tributos divergente. Calculado: ${totalTributos.toFixed(2)}, Informado: ${(dados.totais.vTotTrib || 0).toFixed(2)}`);
      }
    }
  }

  /**
   * Validações de conformidade SEFAZ
   */
  validarConformidadeSefaz(dados) {
    // Ambiente deve ser 1 (produção) ou 2 (homologação)
    if (!dados.ambiente || ![1, 2].includes(dados.ambiente)) {
      this.erros.push('Ambiente deve ser 1 (produção) ou 2 (homologação)');
    }

    // Tipo de emissão deve ser válido
    if (!dados.tipoEmissao || ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(dados.tipoEmissao)) {
      this.erros.push('Tipo de emissão inválido');
    }

    // Finalidade deve ser válida
    if (!dados.finalidade || ![1, 2, 3, 4].includes(dados.finalidade)) {
      this.erros.push('Finalidade da NFe deve ser 1, 2, 3 ou 4');
    }

    // Processo de emissão deve ser válido
    if (dados.processoEmissao === undefined || ![0, 1, 2, 3].includes(dados.processoEmissao)) {
      this.erros.push('Processo de emissão deve ser 0, 1, 2 ou 3');
    }

    // Versão do processo deve ser informada
    if (!dados.versaoProcesso || dados.versaoProcesso.trim().length === 0) {
      this.erros.push('Versão do processo é obrigatória');
    }
  }

  /**
   * Valida CNPJ
   */
  validarCNPJ(cnpj) {
    if (!cnpj) return false;
    
    cnpj = cnpj.replace(/\D/g, '');
    
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;

    let soma = 0;
    let peso = 2;
    
    for (let i = 11; i >= 0; i--) {
      soma += parseInt(cnpj.charAt(i)) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    
    let digito1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    
    soma = 0;
    peso = 2;
    
    for (let i = 12; i >= 0; i--) {
      soma += parseInt(cnpj.charAt(i)) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    
    let digito2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    
    return parseInt(cnpj.charAt(12)) === digito1 && parseInt(cnpj.charAt(13)) === digito2;
  }

  /**
   * Valida CPF
   */
  validarCPF(cpf) {
    if (!cpf) return false;
    
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    
    let digito1 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    
    let digito2 = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    
    return parseInt(cpf.charAt(9)) === digito1 && parseInt(cpf.charAt(10)) === digito2;
  }

  /**
   * Gera relatório de validação
   */
  gerarRelatorioValidacao(resultado) {
    let relatorio = '=== RELATÓRIO DE VALIDAÇÃO XML NFe 4.0 ===\n\n';
    
    relatorio += `Status: ${resultado.valido ? 'VÁLIDO' : 'INVÁLIDO'}\n`;
    relatorio += `Data/Hora: ${new Date().toLocaleString('pt-BR')}\n\n`;

    if (resultado.erros.length > 0) {
      relatorio += '=== ERROS ENCONTRADOS ===\n';
      resultado.erros.forEach((erro, index) => {
        relatorio += `${index + 1}. ${erro}\n`;
      });
      relatorio += '\n';
    }

    if (resultado.avisos.length > 0) {
      relatorio += '=== AVISOS ===\n';
      resultado.avisos.forEach((aviso, index) => {
        relatorio += `${index + 1}. ${aviso}\n`;
      });
      relatorio += '\n';
    }

    if (resultado.valido) {
      relatorio += '✅ XML está em conformidade com a legislação NFe 4.0\n';
    } else {
      relatorio += '❌ XML possui erros que impedem a autorização\n';
    }

    return relatorio;
  }
}

module.exports = XmlValidatorService;