/**
 * ==================== SERVIÇO DE TRIBUTAÇÃO NFE ====================
 * 
 * Serviço responsável por calcular impostos e tributos conforme legislação brasileira
 * Implementa cálculos para ICMS, IPI, PIS, COFINS, ISS, IRPJ, CSLL
 * Suporte à Reforma Tributária (IBS/CBS) conforme NT 2025.002
 * 
 * Baseado na legislação vigente em 2025:
 * - Lei Complementar 87/1996 (ICMS)
 * - Lei 9.718/1998 (PIS/COFINS)
 * - Lei Complementar 214/2025 (IBS/CBS)
 * - Decreto-Lei 1.598/1977 (IPI)
 * 
 * @author Sistema NFe Brandão Contador
 * @version 1.0.0
 * @since 2025-01-20
 */

const logService = require('./log-service');

class TributacaoService {
  constructor() {
    this.aliquotasICMS = this.carregarAliquotasICMS();
    this.aliquotasPIS = this.carregarAliquotasPIS();
    this.aliquotasCOFINS = this.carregarAliquotasCOFINS();
    this.aliquotasIPI = this.carregarAliquotasIPI();
    this.aliquotasISS = this.carregarAliquotasISS();
    
    // Reforma Tributária - IBS/CBS (NT 2025.002)
    this.aliquotasIBS = 0.1; // 0,1% em fase de teste
    this.aliquotasCBS = 0.9; // 0,9% em fase de teste
  }

  // ==================== CÁLCULO PRINCIPAL DE IMPOSTOS ====================

  /**
   * Calcula todos os impostos de um item da NFe
   * @param {Object} item - Item da nota fiscal
   * @param {Object} emitente - Dados do emitente
   * @param {Object} destinatario - Dados do destinatário
   * @param {Object} configuracao - Configurações tributárias
   * @returns {Object} Cálculos tributários completos
   */
  async calcularImpostos(item, emitente, destinatario, configuracao = {}) {
    try {
      const valorUnitario = parseFloat(item.valorUnitario) || 0;
      const quantidade = parseFloat(item.quantidade) || 1;
      const valorTotal = valorUnitario * quantidade;
      const desconto = parseFloat(item.desconto) || 0;
      const valorLiquido = valorTotal - desconto;

      // Determinar regime tributário
      const regimeTributario = this.determinarRegimeTributario(emitente);
      
      // Calcular cada imposto
      const icms = await this.calcularICMS(item, emitente, destinatario, valorLiquido);
      const ipi = await this.calcularIPI(item, emitente, valorLiquido);
      const pis = await this.calcularPIS(item, emitente, valorLiquido, regimeTributario);
      const cofins = await this.calcularCOFINS(item, emitente, valorLiquido, regimeTributario);
      const iss = await this.calcularISS(item, emitente, destinatario, valorLiquido);
      
      // Reforma Tributária (se habilitada)
      const ibs = await this.calcularIBS(item, emitente, valorLiquido);
      const cbs = await this.calcularCBS(item, emitente, valorLiquido);

      // Calcular totais
      const totalImpostos = icms.valor + ipi.valor + pis.valor + cofins.valor + iss.valor;
      const valorFinal = valorLiquido + totalImpostos;

      // Gerar observações fiscais
      const observacoes = this.gerarObservacoesFiscais({
        icms, ipi, pis, cofins, iss, ibs, cbs,
        valorLiquido, totalImpostos, regimeTributario
      });

      return {
        sucesso: true,
        valorBase: valorLiquido,
        impostos: {
          icms,
          ipi,
          pis,
          cofins,
          iss,
          ibs,
          cbs
        },
        totais: {
          baseCalculo: valorLiquido,
          totalImpostos,
          valorFinal,
          percentualCarga: ((totalImpostos / valorLiquido) * 100).toFixed(2)
        },
        observacoes,
        regimeTributario,
        dataCalculo: new Date().toISOString()
      };

    } catch (error) {
      await logService.logErro('tributacao_calcular', error, { item: item.codigo });
      throw new Error(`Erro ao calcular impostos: ${error.message}`);
    }
  }

  // ==================== CÁLCULO ICMS ====================

  /**
   * Calcula ICMS conforme legislação estadual
   * Baseado na Lei Complementar 87/1996
   */
  async calcularICMS(item, emitente, destinatario, valorBase) {
    try {
      const ufOrigem = emitente.endereco?.uf || 'SP';
      const ufDestino = destinatario?.endereco?.uf || ufOrigem;
      const cst = item.tributacao?.icms?.cst || '00';
      
      let aliquota = 0;
      let valor = 0;
      let baseCalculo = valorBase;
      let situacao = 'Tributado integralmente';

      // Determinar alíquota baseada na operação
      if (ufOrigem === ufDestino) {
        // Operação interna
        aliquota = this.aliquotasICMS.interna[ufOrigem] || 18;
      } else {
        // Operação interestadual
        aliquota = this.aliquotasICMS.interestadual[ufOrigem]?.[ufDestino] || 12;
      }

      // Aplicar CST
      switch (cst) {
        case '00': // Tributado integralmente
          valor = (baseCalculo * aliquota) / 100;
          break;
        case '10': // Tributado com cobrança do ICMS por substituição tributária
          valor = (baseCalculo * aliquota) / 100;
          situacao = 'Tributado com ST';
          break;
        case '20': // Com redução de base de cálculo
          const reducao = item.tributacao?.icms?.reducao || 0;
          baseCalculo = valorBase * (1 - reducao / 100);
          valor = (baseCalculo * aliquota) / 100;
          situacao = `Tributado com redução de ${reducao}%`;
          break;
        case '40': // Isento
        case '41': // Não tributado
        case '50': // Suspensão
          valor = 0;
          aliquota = 0;
          situacao = 'Isento/Não tributado';
          break;
        case '60': // ICMS cobrado anteriormente por substituição tributária
          valor = 0;
          aliquota = 0;
          situacao = 'ST já recolhido';
          break;
        case '90': // Outros
          valor = (baseCalculo * aliquota) / 100;
          situacao = 'Outros';
          break;
        default:
          valor = (baseCalculo * aliquota) / 100;
      }

      return {
        tributo: 'ICMS',
        cst,
        aliquota: parseFloat(aliquota.toFixed(2)),
        baseCalculo: parseFloat(baseCalculo.toFixed(2)),
        valor: parseFloat(valor.toFixed(2)),
        situacao,
        ufOrigem,
        ufDestino
      };

    } catch (error) {
      throw new Error(`Erro no cálculo do ICMS: ${error.message}`);
    }
  }

  // ==================== CÁLCULO IPI ====================

  /**
   * Calcula IPI conforme Decreto-Lei 1.598/1977
   * Incide sobre produtos industrializados
   */
  async calcularIPI(item, emitente, valorBase) {
    try {
      const cst = item.tributacao?.ipi?.cst || '99';
      const ncm = item.ncm || '';
      
      let aliquota = 0;
      let valor = 0;
      let baseCalculo = valorBase;
      let situacao = 'Não tributado';

      // Verificar se é produto industrializado
      const isIndustrializado = this.verificarProdutoIndustrializado(ncm, item);
      
      if (isIndustrializado) {
        aliquota = this.obterAliquotaIPI(ncm) || 0;
        
        switch (cst) {
          case '00': // Entrada com recuperação de crédito
          case '49': // Outras entradas
          case '50': // Saída tributada
            valor = (baseCalculo * aliquota) / 100;
            situacao = 'Tributado';
            break;
          case '01': // Entrada tributada com alíquota zero
          case '51': // Saída tributada com alíquota zero
            aliquota = 0;
            valor = 0;
            situacao = 'Tributado com alíquota zero';
            break;
          case '02': // Entrada isenta
          case '52': // Saída isenta
            aliquota = 0;
            valor = 0;
            situacao = 'Isento';
            break;
          case '03': // Entrada não tributada
          case '53': // Saída não tributada
            aliquota = 0;
            valor = 0;
            situacao = 'Não tributado';
            break;
          case '04': // Entrada imune
          case '54': // Saída imune
            aliquota = 0;
            valor = 0;
            situacao = 'Imune';
            break;
          case '05': // Entrada com suspensão
          case '55': // Saída com suspensão
            aliquota = 0;
            valor = 0;
            situacao = 'Suspensão';
            break;
          default:
            aliquota = 0;
            valor = 0;
        }
      }

      return {
        tributo: 'IPI',
        cst,
        aliquota: parseFloat(aliquota.toFixed(2)),
        baseCalculo: parseFloat(baseCalculo.toFixed(2)),
        valor: parseFloat(valor.toFixed(2)),
        situacao,
        ncm,
        industrializado: isIndustrializado
      };

    } catch (error) {
      throw new Error(`Erro no cálculo do IPI: ${error.message}`);
    }
  }

  // ==================== CÁLCULO PIS ====================

  /**
   * Calcula PIS conforme Lei 9.718/1998
   * Considera regime cumulativo e não-cumulativo
   */
  async calcularPIS(item, emitente, valorBase, regimeTributario) {
    try {
      const cst = item.tributacao?.pis?.cst || '01';
      
      let aliquota = 0;
      let valor = 0;
      let baseCalculo = valorBase;
      let situacao = 'Tributado';

      // Determinar alíquota baseada no regime tributário
      if (regimeTributario === 'simples_nacional') {
        // No Simples Nacional, PIS está incluído no DAS
        aliquota = 0;
        valor = 0;
        situacao = 'Simples Nacional';
      } else if (regimeTributario === 'lucro_presumido') {
        // Regime cumulativo
        aliquota = this.aliquotasPIS.cumulativo;
      } else {
        // Regime não-cumulativo (Lucro Real)
        aliquota = this.aliquotasPIS.naoCumulativo;
      }

      // Aplicar CST
      switch (cst) {
        case '01': // Operação tributável com alíquota básica
        case '02': // Operação tributável com alíquota diferenciada
          valor = (baseCalculo * aliquota) / 100;
          break;
        case '03': // Operação tributável com alíquota por unidade
          // Implementar cálculo por unidade se necessário
          valor = (baseCalculo * aliquota) / 100;
          break;
        case '04': // Operação tributável monofásica
          // Verificar se é contribuinte da tributação monofásica
          valor = this.calcularPISMonofasico(item, baseCalculo);
          situacao = 'Monofásico';
          break;
        case '05': // Operação tributável por substituição tributária
          valor = 0;
          situacao = 'Substituição tributária';
          break;
        case '06': // Operação tributável a alíquota zero
          aliquota = 0;
          valor = 0;
          situacao = 'Alíquota zero';
          break;
        case '07': // Operação isenta da contribuição
          aliquota = 0;
          valor = 0;
          situacao = 'Isento';
          break;
        case '08': // Operação sem incidência da contribuição
          aliquota = 0;
          valor = 0;
          situacao = 'Sem incidência';
          break;
        case '09': // Operação com suspensão da contribuição
          aliquota = 0;
          valor = 0;
          situacao = 'Suspensão';
          break;
        case '99': // Outras operações
          valor = (baseCalculo * aliquota) / 100;
          situacao = 'Outras operações';
          break;
        default:
          valor = (baseCalculo * aliquota) / 100;
      }

      return {
        tributo: 'PIS',
        cst,
        aliquota: parseFloat(aliquota.toFixed(4)),
        baseCalculo: parseFloat(baseCalculo.toFixed(2)),
        valor: parseFloat(valor.toFixed(2)),
        situacao,
        regime: regimeTributario
      };

    } catch (error) {
      throw new Error(`Erro no cálculo do PIS: ${error.message}`);
    }
  }

  // ==================== CÁLCULO COFINS ====================

  /**
   * Calcula COFINS conforme Lei 9.718/1998
   * Considera regime cumulativo e não-cumulativo
   */
  async calcularCOFINS(item, emitente, valorBase, regimeTributario) {
    try {
      const cst = item.tributacao?.cofins?.cst || '01';
      
      let aliquota = 0;
      let valor = 0;
      let baseCalculo = valorBase;
      let situacao = 'Tributado';

      // Determinar alíquota baseada no regime tributário
      if (regimeTributario === 'simples_nacional') {
        // No Simples Nacional, COFINS está incluído no DAS
        aliquota = 0;
        valor = 0;
        situacao = 'Simples Nacional';
      } else if (regimeTributario === 'lucro_presumido') {
        // Regime cumulativo
        aliquota = this.aliquotasCOFINS.cumulativo;
      } else {
        // Regime não-cumulativo (Lucro Real)
        aliquota = this.aliquotasCOFINS.naoCumulativo;
      }

      // Aplicar CST (similar ao PIS)
      switch (cst) {
        case '01': // Operação tributável com alíquota básica
        case '02': // Operação tributável com alíquota diferenciada
          valor = (baseCalculo * aliquota) / 100;
          break;
        case '03': // Operação tributável com alíquota por unidade
          valor = (baseCalculo * aliquota) / 100;
          break;
        case '04': // Operação tributável monofásica
          valor = this.calcularCOFINSMonofasico(item, baseCalculo);
          situacao = 'Monofásico';
          break;
        case '05': // Operação tributável por substituição tributária
          valor = 0;
          situacao = 'Substituição tributária';
          break;
        case '06': // Operação tributável a alíquota zero
          aliquota = 0;
          valor = 0;
          situacao = 'Alíquota zero';
          break;
        case '07': // Operação isenta da contribuição
          aliquota = 0;
          valor = 0;
          situacao = 'Isento';
          break;
        case '08': // Operação sem incidência da contribuição
          aliquota = 0;
          valor = 0;
          situacao = 'Sem incidência';
          break;
        case '09': // Operação com suspensão da contribuição
          aliquota = 0;
          valor = 0;
          situacao = 'Suspensão';
          break;
        case '99': // Outras operações
          valor = (baseCalculo * aliquota) / 100;
          situacao = 'Outras operações';
          break;
        default:
          valor = (baseCalculo * aliquota) / 100;
      }

      return {
        tributo: 'COFINS',
        cst,
        aliquota: parseFloat(aliquota.toFixed(4)),
        baseCalculo: parseFloat(baseCalculo.toFixed(2)),
        valor: parseFloat(valor.toFixed(2)),
        situacao,
        regime: regimeTributario
      };

    } catch (error) {
      throw new Error(`Erro no cálculo do COFINS: ${error.message}`);
    }
  }

  // ==================== CÁLCULO ISS ====================

  /**
   * Calcula ISS para serviços
   * Imposto municipal conforme LC 116/2003
   */
  async calcularISS(item, emitente, destinatario, valorBase) {
    try {
      // ISS só incide sobre serviços
      if (item.tipo !== 'servico') {
        return {
          tributo: 'ISS',
          aliquota: 0,
          baseCalculo: 0,
          valor: 0,
          situacao: 'Não incide sobre produtos',
          municipio: null
        };
      }

      const codigoServico = item.codigoServico || '';
      const municipio = destinatario?.endereco?.municipio || emitente.endereco?.municipio;
      
      let aliquota = this.obterAliquotaISS(codigoServico, municipio) || 5; // Padrão 5%
      let valor = 0;
      let baseCalculo = valorBase;
      let situacao = 'Tributado';

      // Verificar retenção de ISS
      const retencaoISS = item.tributacao?.iss?.retencao || false;
      
      if (retencaoISS) {
        situacao = 'Retido na fonte';
      }

      valor = (baseCalculo * aliquota) / 100;

      return {
        tributo: 'ISS',
        aliquota: parseFloat(aliquota.toFixed(2)),
        baseCalculo: parseFloat(baseCalculo.toFixed(2)),
        valor: parseFloat(valor.toFixed(2)),
        situacao,
        municipio,
        codigoServico,
        retencao: retencaoISS
      };

    } catch (error) {
      throw new Error(`Erro no cálculo do ISS: ${error.message}`);
    }
  }

  // ==================== REFORMA TRIBUTÁRIA - IBS/CBS ====================

  /**
   * Calcula IBS (Imposto sobre Bens e Serviços)
   * Conforme NT 2025.002 - Reforma Tributária
   */
  async calcularIBS(item, emitente, valorBase) {
    try {
      // IBS substitui ICMS, ISS e IPI a partir de 2026
      const faseImplementacao = process.env.REFORMA_TRIBUTARIA_ATIVA === 'true';
      
      if (!faseImplementacao) {
        return {
          tributo: 'IBS',
          aliquota: 0,
          baseCalculo: 0,
          valor: 0,
          situacao: 'Não implementado',
          fase: 'Aguardando implementação'
        };
      }

      const aliquota = this.aliquotasIBS; // 0,1% em fase de teste
      const valor = (valorBase * aliquota) / 100;

      return {
        tributo: 'IBS',
        aliquota: parseFloat(aliquota.toFixed(4)),
        baseCalculo: parseFloat(valorBase.toFixed(2)),
        valor: parseFloat(valor.toFixed(2)),
        situacao: 'Fase de teste',
        fase: 'Teste 2026',
        observacao: 'Valor será descontado do PIS/COFINS'
      };

    } catch (error) {
      throw new Error(`Erro no cálculo do IBS: ${error.message}`);
    }
  }

  /**
   * Calcula CBS (Contribuição sobre Bens e Serviços)
   * Conforme NT 2025.002 - Reforma Tributária
   */
  async calcularCBS(item, emitente, valorBase) {
    try {
      // CBS substitui PIS e COFINS a partir de 2026
      const faseImplementacao = process.env.REFORMA_TRIBUTARIA_ATIVA === 'true';
      
      if (!faseImplementacao) {
        return {
          tributo: 'CBS',
          aliquota: 0,
          baseCalculo: 0,
          valor: 0,
          situacao: 'Não implementado',
          fase: 'Aguardando implementação'
        };
      }

      const aliquota = this.aliquotasCBS; // 0,9% em fase de teste
      const valor = (valorBase * aliquota) / 100;

      return {
        tributo: 'CBS',
        aliquota: parseFloat(aliquota.toFixed(4)),
        baseCalculo: parseFloat(valorBase.toFixed(2)),
        valor: parseFloat(valor.toFixed(2)),
        situacao: 'Fase de teste',
        fase: 'Teste 2026',
        observacao: 'Valor será descontado do PIS/COFINS'
      };

    } catch (error) {
      throw new Error(`Erro no cálculo do CBS: ${error.message}`);
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Determina o regime tributário do emitente
   */
  determinarRegimeTributario(emitente) {
    const crt = emitente.crt || '3';
    
    switch (crt) {
      case '1': return 'simples_nacional';
      case '2': return 'simples_nacional_excesso';
      case '3': return 'lucro_real';
      default: return 'lucro_presumido';
    }
  }

  /**
   * Verifica se o produto é industrializado para IPI
   */
  verificarProdutoIndustrializado(ncm, item) {
    // Lista de NCMs que indicam produtos industrializados
    const ncmsIndustrializados = [
      // Adicionar NCMs conforme necessário
      '84', '85', '87', '90' // Exemplos: máquinas, equipamentos, veículos, instrumentos
    ];
    
    const prefixoNCM = ncm.substring(0, 2);
    return ncmsIndustrializados.includes(prefixoNCM) || item.industrializado === true;
  }

  /**
   * Calcula PIS monofásico
   */
  calcularPISMonofasico(item, baseCalculo) {
    // Implementar cálculo específico para produtos monofásicos
    const aliquotaMonofasica = 1.65; // Exemplo
    return (baseCalculo * aliquotaMonofasica) / 100;
  }

  /**
   * Calcula COFINS monofásico
   */
  calcularCOFINSMonofasico(item, baseCalculo) {
    // Implementar cálculo específico para produtos monofásicos
    const aliquotaMonofasica = 7.6; // Exemplo
    return (baseCalculo * aliquotaMonofasica) / 100;
  }

  /**
   * Gera observações fiscais detalhadas
   */
  gerarObservacoesFiscais(dados) {
    const observacoes = [];
    
    // Informações sobre impostos
    if (dados.icms.valor > 0) {
      observacoes.push(`ICMS: R$ ${dados.icms.valor.toFixed(2)} (${dados.icms.aliquota}%) - ${dados.icms.situacao}`);
    }
    
    if (dados.ipi.valor > 0) {
      observacoes.push(`IPI: R$ ${dados.ipi.valor.toFixed(2)} (${dados.ipi.aliquota}%) - ${dados.ipi.situacao}`);
    }
    
    if (dados.pis.valor > 0) {
      observacoes.push(`PIS: R$ ${dados.pis.valor.toFixed(2)} (${dados.pis.aliquota}%) - ${dados.pis.regime}`);
    }
    
    if (dados.cofins.valor > 0) {
      observacoes.push(`COFINS: R$ ${dados.cofins.valor.toFixed(2)} (${dados.cofins.aliquota}%) - ${dados.cofins.regime}`);
    }
    
    if (dados.iss.valor > 0) {
      observacoes.push(`ISS: R$ ${dados.iss.valor.toFixed(2)} (${dados.iss.aliquota}%) - ${dados.iss.municipio}`);
    }

    // Informações sobre carga tributária
    const percentualCarga = ((dados.totalImpostos / dados.valorLiquido) * 100).toFixed(2);
    observacoes.push(`Carga tributária total: ${percentualCarga}%`);
    
    // Informações sobre regime tributário
    observacoes.push(`Regime tributário: ${dados.regimeTributario.replace('_', ' ').toUpperCase()}`);
    
    // Informações sobre Reforma Tributária (se aplicável)
    if (dados.ibs.valor > 0 || dados.cbs.valor > 0) {
      observacoes.push('--- REFORMA TRIBUTÁRIA (FASE DE TESTE) ---');
      if (dados.ibs.valor > 0) {
        observacoes.push(`IBS: R$ ${dados.ibs.valor.toFixed(2)} (${dados.ibs.aliquota}%)`);
      }
      if (dados.cbs.valor > 0) {
        observacoes.push(`CBS: R$ ${dados.cbs.valor.toFixed(2)} (${dados.cbs.aliquota}%)`);
      }
    }

    return observacoes.join(' | ');
  }

  // ==================== CARREGAMENTO DE ALÍQUOTAS ====================

  carregarAliquotasICMS() {
    return {
      interna: {
        'AC': 17, 'AL': 17, 'AP': 18, 'AM': 18, 'BA': 18, 'CE': 18,
        'DF': 18, 'ES': 17, 'GO': 17, 'MA': 18, 'MT': 17, 'MS': 17,
        'MG': 18, 'PA': 17, 'PB': 18, 'PR': 18, 'PE': 18, 'PI': 18,
        'RJ': 18, 'RN': 18, 'RS': 18, 'RO': 17.5, 'RR': 17, 'SC': 17,
        'SP': 18, 'SE': 18, 'TO': 18
      },
      interestadual: {
        // Simplificado - implementar tabela completa conforme necessário
        'SP': { 'RJ': 12, 'MG': 12, 'PR': 12, 'SC': 12, 'RS': 12 },
        'RJ': { 'SP': 12, 'MG': 12, 'ES': 12 }
        // Adicionar demais UFs conforme necessário
      }
    };
  }

  carregarAliquotasPIS() {
    return {
      cumulativo: 0.65,     // Lucro Presumido
      naoCumulativo: 1.65   // Lucro Real
    };
  }

  carregarAliquotasCOFINS() {
    return {
      cumulativo: 3.0,      // Lucro Presumido
      naoCumulativo: 7.6    // Lucro Real
    };
  }

  carregarAliquotasIPI() {
    // Implementar tabela TIPI conforme necessário
    return {
      '84': 10,  // Máquinas
      '85': 15,  // Equipamentos elétricos
      '87': 25,  // Veículos
      '90': 12   // Instrumentos
    };
  }

  carregarAliquotasISS() {
    // Implementar tabela de serviços conforme LC 116/2003
    return {
      '01.01': 5,  // Análise e desenvolvimento de sistemas
      '01.02': 5,  // Programação
      '01.03': 5,  // Processamento de dados
      '17.01': 5,  // Assessoria ou consultoria
      '17.02': 5   // Planejamento, coordenação, programação ou organização técnica
    };
  }

  /**
   * Obtém alíquota de IPI por NCM
   */
  obterAliquotaIPI(ncm) {
    const prefixo = ncm.substring(0, 2);
    return this.aliquotasIPI[prefixo] || 0;
  }

  /**
   * Obtém alíquota de ISS por código de serviço e município
   */
  obterAliquotaISS(codigoServico, municipio) {
    // Implementar consulta por município se necessário
    return this.aliquotasISS[codigoServico] || 5; // Padrão 5%
  }
}

module.exports = TributacaoService;