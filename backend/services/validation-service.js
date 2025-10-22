class ValidationService {
  
  // ==================== VALIDAÇÃO PRINCIPAL ====================

  async validarDadosNfe(dados, opcoes = {}) {
    const erros = [];
    const avisos = [];
    const { rascunho = false } = opcoes;

    try {
      if (rascunho) {
        // Validações mais flexíveis para rascunho
        this.validarRascunho(dados, erros, avisos);
      } else {
        // Validações obrigatórias para emissão
        this.validarEmitente(dados.emitente, erros);
        this.validarDestinatario(dados.destinatario, erros);
        this.validarItens(dados.itens, erros);
        this.validarTotais(dados.totais, erros);
        this.validarDadosGerais(dados, erros);
      }

      // Validações de aviso (não impedem emissão)
      this.validarAvisos(dados, avisos);

      return {
        valido: erros.length === 0,
        erros,
        avisos,
        rascunho
      };

    } catch (error) {
      erros.push(`Erro na validação: ${error.message}`);
      return {
        valido: false,
        erros,
        avisos,
        rascunho
      };
    }
  }

  // ==================== VALIDAÇÃO DE RASCUNHO ====================

  validarRascunho(dados, erros, avisos) {
    // Para rascunho, apenas validações básicas e avisos
    
    // Validar destinatário se informado
    if (dados.destinatario) {
      if (dados.destinatario.nome && dados.destinatario.nome.trim().length < 2) {
        avisos.push("Nome do destinatário deve ter pelo menos 2 caracteres");
      }
      
      if (dados.destinatario.documento) {
        const documento = dados.destinatario.documento.replace(/\D/g, '');
        if (documento.length === 11 && !this.validarCPF(documento)) {
          avisos.push("CPF do destinatário parece inválido");
        } else if (documento.length === 14 && !this.validarCNPJ(documento)) {
          avisos.push("CNPJ do destinatário parece inválido");
        }
      }
      
      if (dados.destinatario.email && !this.validarEmail(dados.destinatario.email)) {
        avisos.push("Email do destinatário parece inválido");
      }
      
      // Validar endereço se informado
      if (dados.destinatario.endereco) {
        if (dados.destinatario.endereco.cep && !this.validarCEP(dados.destinatario.endereco.cep)) {
          avisos.push("CEP parece inválido");
        }
      }
    }
    
    // Validar itens se informados
    if (dados.itens && Array.isArray(dados.itens)) {
      dados.itens.forEach((item, index) => {
        const posicao = index + 1;
        
        if (item.quantidade && item.quantidade <= 0) {
          avisos.push(`Item ${posicao}: Quantidade deve ser maior que zero`);
        }
        
        if (item.valorUnitario && item.valorUnitario <= 0) {
          avisos.push(`Item ${posicao}: Valor unitário deve ser maior que zero`);
        }
        
        if (item.cfop && !/^\d{4}$/.test(item.cfop)) {
          avisos.push(`Item ${posicao}: CFOP deve ter 4 dígitos`);
        }
      });
    }
    
    // Validações mínimas obrigatórias apenas se dados estiverem muito incompletos
    if (!dados.destinatario && !dados.itens) {
      erros.push("Rascunho deve ter pelo menos dados do destinatário ou itens");
    }
  }
  
  validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // ==================== VALIDAÇÃO DE EMITENTE ====================

  validarEmitente(emitente, erros) {
    if (!emitente) {
      erros.push("Dados do emitente são obrigatórios");
      return;
    }

    // Nome/Razão Social
    const nomeEmitente = emitente.nome || emitente.razaoSocial;
    if (!nomeEmitente || nomeEmitente.trim().length < 2) {
      erros.push("Nome/Razão Social do emitente é obrigatório (mín. 2 caracteres)");
    }

    if (nomeEmitente && nomeEmitente.length > 60) {
      erros.push("Nome/Razão Social do emitente deve ter no máximo 60 caracteres");
    }

    // CNPJ
    if (!emitente.cnpj) {
      erros.push("CNPJ do emitente é obrigatório");
    } else if (!this.validarCNPJ(emitente.cnpj)) {
      erros.push("CNPJ do emitente inválido");
    }

    // Inscrição Estadual
    if (!emitente.inscricaoEstadual) {
      erros.push("Inscrição Estadual do emitente é obrigatória");
    }

    // Endereço
    this.validarEndereco(emitente.endereco, "emitente", erros);
  }

  // ==================== VALIDAÇÃO DE DESTINATÁRIO ====================

  validarDestinatario(destinatario, erros) {
    if (!destinatario) {
      erros.push("Dados do destinatário são obrigatórios");
      return;
    }

    // Nome/Razão Social
    const nomeDestinatario = destinatario.nome || destinatario.razaoSocial;
    if (!nomeDestinatario || nomeDestinatario.trim().length < 2) {
      erros.push("Nome/Razão Social do destinatário é obrigatório (mín. 2 caracteres)");
    }

    if (nomeDestinatario && nomeDestinatario.length > 60) {
      erros.push("Nome/Razão Social do destinatário deve ter no máximo 60 caracteres");
    }

    // CNPJ ou CPF
    if (!destinatario.cnpj && !destinatario.cpf) {
      erros.push("CNPJ ou CPF do destinatário é obrigatório");
    } else {
      if (destinatario.cnpj && !this.validarCNPJ(destinatario.cnpj)) {
        erros.push("CNPJ do destinatário inválido");
      }
      if (destinatario.cpf && !this.validarCPF(destinatario.cpf)) {
        erros.push("CPF do destinatário inválido");
      }
    }

    // Endereço
    this.validarEndereco(destinatario.endereco, "destinatário", erros);
  }

  // ==================== VALIDAÇÃO DE ENDEREÇO ====================

  validarEndereco(endereco, tipo, erros) {
    if (!endereco) {
      erros.push(`Endereço do ${tipo} é obrigatório`);
      return;
    }

    // Logradouro
    if (!endereco.logradouro || endereco.logradouro.trim().length < 2) {
      erros.push(`Logradouro do ${tipo} é obrigatório (mín. 2 caracteres)`);
    }

    if (endereco.logradouro && endereco.logradouro.length > 60) {
      erros.push(`Logradouro do ${tipo} deve ter no máximo 60 caracteres`);
    }

    // Número
    if (!endereco.numero || endereco.numero.trim().length === 0) {
      erros.push(`Número do endereço do ${tipo} é obrigatório`);
    }

    // Bairro
    if (!endereco.bairro || endereco.bairro.trim().length < 2) {
      erros.push(`Bairro do ${tipo} é obrigatório (mín. 2 caracteres)`);
    }

    // CEP
    if (!endereco.cep) {
      erros.push(`CEP do ${tipo} é obrigatório`);
    } else if (!this.validarCEP(endereco.cep)) {
      erros.push(`CEP do ${tipo} inválido`);
    }

    // Município
    if (!endereco.municipio || endereco.municipio.trim().length < 2) {
      erros.push(`Município do ${tipo} é obrigatório`);
    }

    // Código do Município
    if (!endereco.codigoMunicipio) {
      erros.push(`Código do município do ${tipo} é obrigatório`);
    } else if (!/^\d{7}$/.test(endereco.codigoMunicipio)) {
      erros.push(`Código do município do ${tipo} deve ter 7 dígitos`);
    }

    // UF
    if (!endereco.uf) {
      erros.push(`UF do ${tipo} é obrigatória`);
    } else if (!/^[A-Z]{2}$/.test(endereco.uf)) {
      erros.push(`UF do ${tipo} deve ter 2 letras maiúsculas`);
    }
  }

  // ==================== VALIDAÇÃO DE ITENS ====================

  validarItens(itens, erros) {
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      erros.push("Pelo menos um item é obrigatório");
      return;
    }

    if (itens.length > 990) {
      erros.push("Máximo de 990 itens permitidos");
    }

    itens.forEach((item, index) => {
      const posicao = index + 1;

      // Código do produto
      if (!item.codigo || item.codigo.trim().length === 0) {
        erros.push(`Item ${posicao}: Código do produto é obrigatório`);
      }

      if (item.codigo && item.codigo.length > 60) {
        erros.push(`Item ${posicao}: Código do produto deve ter no máximo 60 caracteres`);
      }

      // Descrição
      if (!item.descricao || item.descricao.trim().length < 1) {
        erros.push(`Item ${posicao}: Descrição do produto é obrigatória`);
      }

      if (item.descricao && item.descricao.length > 120) {
        erros.push(`Item ${posicao}: Descrição deve ter no máximo 120 caracteres`);
      }

      // CFOP - Validação mais específica
      if (!item.cfop) {
        erros.push(`Item ${posicao}: CFOP é obrigatório`);
      } else if (!/^\d{4}$/.test(item.cfop)) {
        erros.push(`Item ${posicao}: CFOP deve ter 4 dígitos`);
      } else {
        this.validarCFOP(item.cfop, posicao, erros);
      }

      // NCM - Validação específica
      if (!item.ncm) {
        erros.push(`Item ${posicao}: NCM é obrigatório`);
      } else if (!/^\d{8}$/.test(item.ncm)) {
        erros.push(`Item ${posicao}: NCM deve ter 8 dígitos`);
      } else {
        this.validarNCM(item.ncm, posicao, erros);
      }

      // Unidade
      if (!item.unidade || item.unidade.trim().length === 0) {
        erros.push(`Item ${posicao}: Unidade é obrigatória`);
      }

      if (item.unidade && item.unidade.length > 6) {
        erros.push(`Item ${posicao}: Unidade deve ter no máximo 6 caracteres`);
      }

      // Quantidade
      if (!item.quantidade || item.quantidade <= 0) {
        erros.push(`Item ${posicao}: Quantidade deve ser maior que zero`);
      }

      if (item.quantidade && item.quantidade > 999999999.9999) {
        erros.push(`Item ${posicao}: Quantidade muito alta`);
      }

      // Valor unitário
      if (!item.valorUnitario || item.valorUnitario <= 0) {
        erros.push(`Item ${posicao}: Valor unitário deve ser maior que zero`);
      }

      // Valor total
      if (!item.valorTotal || item.valorTotal <= 0) {
        erros.push(`Item ${posicao}: Valor total deve ser maior que zero`);
      }

      // Validação de cálculo
      if (item.quantidade && item.valorUnitario && item.valorTotal) {
        const valorCalculado = parseFloat((item.quantidade * item.valorUnitario).toFixed(2));
        const valorInformado = parseFloat(item.valorTotal);
        
        if (Math.abs(valorCalculado - valorInformado) > 0.01) {
          erros.push(`Item ${posicao}: Valor total não confere com quantidade × valor unitário`);
        }
      }

      // Validações de impostos
      this.validarImpostosItem(item, posicao, erros);
    });
  }

  // ==================== VALIDAÇÕES ESPECÍFICAS SEFAZ ====================

  validarCFOP(cfop, posicao, erros) {
    const cfopsValidos = {
      // Vendas dentro do estado
      '5101': 'Venda de produção do estabelecimento',
      '5102': 'Venda de mercadoria adquirida ou recebida de terceiros',
      '5103': 'Venda de produção do estabelecimento, que não deva por ele transitar',
      '5104': 'Venda de mercadoria adquirida ou recebida de terceiros, que não deva por ele transitar',
      '5109': 'Venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio',
      '5110': 'Venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio',
      '5116': 'Venda de produção do estabelecimento originada de encomenda para entrega futura',
      '5117': 'Venda de mercadoria adquirida ou recebida de terceiros, originada de encomenda para entrega futura',
      '5118': 'Venda de produção do estabelecimento entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem',
      '5119': 'Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário por conta e ordem do adquirente originário, em venda à ordem',
      '5120': 'Venda de mercadoria adquirida ou recebida de terceiros entregue ao destinatário pelo vendedor remetente, em venda à ordem',
      
      // Vendas para outros estados
      '6101': 'Venda de produção do estabelecimento',
      '6102': 'Venda de mercadoria adquirida ou recebida de terceiros',
      '6103': 'Venda de produção do estabelecimento, que não deva por ele transitar',
      '6104': 'Venda de mercadoria adquirida ou recebida de terceiros, que não deva por ele transitar',
      '6107': 'Venda de produção do estabelecimento, que deva transitar pelo estabelecimento do vendedor',
      '6108': 'Venda de mercadoria adquirida ou recebida de terceiros, que deva transitar pelo estabelecimento do vendedor',
      '6109': 'Venda de produção do estabelecimento, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio',
      '6110': 'Venda de mercadoria adquirida ou recebida de terceiros, destinada à Zona Franca de Manaus ou Áreas de Livre Comércio',
      
      // Prestação de serviços
      '5933': 'Prestação de serviço sujeito ao ICMS',
      '6933': 'Prestação de serviço sujeito ao ICMS'
    };

    if (!cfopsValidos[cfop]) {
      erros.push(`Item ${posicao}: CFOP ${cfop} não é válido ou não está cadastrado`);
    }
  }

  validarNCM(ncm, posicao, erros) {
    // Validação básica de formato NCM
    if (!/^\d{8}$/.test(ncm)) {
      erros.push(`Item ${posicao}: NCM deve conter exatamente 8 dígitos`);
      return;
    }

    // Validação de capítulos NCM válidos (01 a 99)
    const capitulo = ncm.substring(0, 2);
    const capituloNum = parseInt(capitulo);
    
    if (capituloNum < 1 || capituloNum > 99) {
      erros.push(`Item ${posicao}: Capítulo NCM ${capitulo} inválido (deve estar entre 01 e 99)`);
    }

    // Validação de alguns NCMs específicos comuns
    const ncmsEspeciais = {
      '00000000': 'NCM genérico não permitido',
      '99999999': 'NCM inválido'
    };

    if (ncmsEspeciais[ncm]) {
      erros.push(`Item ${posicao}: ${ncmsEspeciais[ncm]}`);
    }
  }

  // ==================== VALIDAÇÃO DE IMPOSTOS ====================

  validarImpostosItem(item, posicao, erros) {
    // ICMS
    if (item.aliquotaICMS !== undefined) {
      if (item.aliquotaICMS < 0 || item.aliquotaICMS > 100) {
        erros.push(`Item ${posicao}: Alíquota ICMS deve estar entre 0% e 100%`);
      }
    }

    if (item.baseCalculoICMS !== undefined) {
      if (item.baseCalculoICMS < 0) {
        erros.push(`Item ${posicao}: Base de cálculo ICMS não pode ser negativa`);
      }
    }

    if (item.valorICMS !== undefined) {
      if (item.valorICMS < 0) {
        erros.push(`Item ${posicao}: Valor ICMS não pode ser negativo`);
      }
    }
  }

  // ==================== VALIDAÇÃO DE TOTAIS ====================

  validarTotais(totais, erros) {
    if (!totais) {
      erros.push("Totais da NFe são obrigatórios");
      return;
    }

    // Valor dos produtos
    if (!totais.valorProdutos || totais.valorProdutos <= 0) {
      erros.push("Valor total dos produtos deve ser maior que zero");
    }

    // Valor total da NFe
    if (!totais.valorTotal || totais.valorTotal <= 0) {
      erros.push("Valor total da NFe deve ser maior que zero");
    }

    // Base de cálculo ICMS
    if (totais.baseCalculoICMS !== undefined && totais.baseCalculoICMS < 0) {
      erros.push("Base de cálculo ICMS não pode ser negativa");
    }

    // Valor ICMS
    if (totais.valorICMS !== undefined && totais.valorICMS < 0) {
      erros.push("Valor ICMS não pode ser negativo");
    }

    // Validação de limites
    if (totais.valorTotal > 999999999.99) {
      erros.push("Valor total da NFe excede o limite máximo");
    }
  }

  // ==================== VALIDAÇÃO DE DADOS GERAIS ====================

  validarDadosGerais(dados, erros) {
    // Número da NFe — agora opcional quando o backend controla a numeração
    if (dados.numero !== undefined && dados.numero !== null) {
      const numero = Number(dados.numero);
      if (Number.isNaN(numero) || numero <= 0) {
        erros.push("Número da NFe deve ser maior que zero");
      } else if (numero > 999999999) {
        erros.push("Número da NFe deve ter no máximo 9 dígitos");
      }
    }

    // Série — opcional, usa padrão de configuração quando ausente
    if (dados.serie !== undefined && dados.serie !== null) {
      const serie = Number(dados.serie);
      if (Number.isNaN(serie) || serie <= 0) {
        erros.push("Série da NFe deve ser maior que zero");
      } else if (serie > 999) {
        erros.push("Série da NFe deve ter no máximo 3 dígitos");
      }
    }

    // Natureza da operação - Validação mais específica
    if (!dados.naturezaOperacao || dados.naturezaOperacao.trim().length === 0) {
      erros.push("Natureza da operação é obrigatória");
    } else {
      this.validarNaturezaOperacao(dados.naturezaOperacao, erros);
    }

    // Tipo de operação
    if (dados.tipoOperacao && ![0, 1].includes(dados.tipoOperacao)) {
      erros.push("Tipo de operação deve ser 0 (Entrada) ou 1 (Saída)");
    }

    // Finalidade da emissão
    if (dados.finalidade && ![1, 2, 3, 4].includes(dados.finalidade)) {
      erros.push("Finalidade deve ser: 1-Normal, 2-Complementar, 3-Ajuste, 4-Devolução");
    }

    // Presença do comprador
    if (dados.presencaComprador && ![0, 1, 2, 3, 4, 5, 9].includes(dados.presencaComprador)) {
      erros.push("Presença do comprador deve ser: 0-Não se aplica, 1-Presencial, 2-Internet, 3-Teleatendimento, 4-NFCe entrega domicílio, 5-Presencial fora estabelecimento, 9-Outros");
    }
  }

  validarNaturezaOperacao(natureza, erros) {
    if (natureza.length > 60) {
      erros.push("Natureza da operação deve ter no máximo 60 caracteres");
    }

    if (natureza.length < 1) {
      erros.push("Natureza da operação deve ter pelo menos 1 caractere");
    }

    // Validação de naturezas comuns
    const naturezasComuns = [
      'VENDA',
      'VENDA DE MERCADORIA',
      'VENDA DE PRODUÇÃO PRÓPRIA',
      'VENDA DE MERCADORIA ADQUIRIDA',
      'PRESTAÇÃO DE SERVIÇOS',
      'REMESSA PARA DEMONSTRAÇÃO',
      'REMESSA PARA CONSERTO',
      'DEVOLUÇÃO DE VENDA',
      'DEVOLUÇÃO DE COMPRA',
      'TRANSFERÊNCIA',
      'BONIFICAÇÃO',
      'BRINDE',
      'DOAÇÃO'
    ];

    // Verifica se contém pelo menos uma palavra-chave válida
    const naturezaUpper = natureza.toUpperCase();
    const contemPalavraValida = naturezasComuns.some(nat => 
      naturezaUpper.includes(nat) || nat.includes(naturezaUpper)
    );

    if (!contemPalavraValida && natureza.length < 10) {
      erros.push("Natureza da operação muito genérica. Seja mais específico (ex: 'Venda de mercadoria')");
    }
  }

  // ==================== VALIDAÇÕES DE AVISO ====================

  validarAvisos(dados, avisos) {
    // Verifica se há itens com valor muito baixo
    if (dados.itens) {
      dados.itens.forEach((item, index) => {
        if (item.valorUnitario && item.valorUnitario < 0.01) {
          avisos.push(`Item ${index + 1}: Valor unitário muito baixo (R$ ${item.valorUnitario})`);
        }
      });
    }

    // Verifica se o valor total é muito alto
    if (dados.totais && dados.totais.valorTotal > 100000) {
      avisos.push(`Valor total alto: R$ ${dados.totais.valorTotal.toFixed(2)}`);
    }

    // Verifica se há muitos itens
    if (dados.itens && dados.itens.length > 100) {
      avisos.push(`Muitos itens na NFe: ${dados.itens.length} itens`);
    }
  }

  // ==================== VALIDAÇÃO DE CHAVE NFE ====================

  validarChaveNfe(chave) {
    if (!chave) return false;
    
    // Remove espaços e caracteres especiais
    chave = chave.replace(/\D/g, '');
    
    // Deve ter 44 dígitos
    if (chave.length !== 44) return false;
    
    // Validação do dígito verificador (módulo 11)
    const chaveBase = chave.substring(0, 43);
    const dv = parseInt(chave.substring(43, 44));
    
    return this.calcularDVChave(chaveBase) === dv;
  }

  calcularDVChave(chave) {
    let soma = 0;
    let peso = 2;
    
    for (let i = chave.length - 1; i >= 0; i--) {
      soma += parseInt(chave[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  // ==================== VALIDAÇÕES AUXILIARES ====================

  validarCNPJ(cnpj) {
    if (!cnpj) return false;
    
    cnpj = cnpj.replace(/\D/g, '');
    
    if (cnpj.length !== 14) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cnpj)) return false;
    
    // Validação dos dígitos verificadores
    let soma = 0;
    let peso = 5;
    
    for (let i = 0; i < 12; i++) {
      soma += parseInt(cnpj[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    
    let dv1 = soma % 11;
    dv1 = dv1 < 2 ? 0 : 11 - dv1;
    
    if (parseInt(cnpj[12]) !== dv1) return false;
    
    soma = 0;
    peso = 6;
    
    for (let i = 0; i < 13; i++) {
      soma += parseInt(cnpj[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    
    let dv2 = soma % 11;
    dv2 = dv2 < 2 ? 0 : 11 - dv2;
    
    return parseInt(cnpj[13]) === dv2;
  }

  validarCPF(cpf) {
    if (!cpf) return false;
    
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    // Validação dos dígitos verificadores
    let soma = 0;
    
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf[i]) * (10 - i);
    }
    
    let dv1 = soma % 11;
    dv1 = dv1 < 2 ? 0 : 11 - dv1;
    
    if (parseInt(cpf[9]) !== dv1) return false;
    
    soma = 0;
    
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf[i]) * (11 - i);
    }
    
    let dv2 = soma % 11;
    dv2 = dv2 < 2 ? 0 : 11 - dv2;
    
    return parseInt(cpf[10]) === dv2;
  }

  validarCEP(cep) {
    if (!cep) return false;
    
    cep = cep.replace(/\D/g, '');
    
    return cep.length === 8 && /^\d{8}$/.test(cep);
  }
}

module.exports = new ValidationService();