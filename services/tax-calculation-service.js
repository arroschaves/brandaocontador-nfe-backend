/**
 * Serviço de Cálculos Tributários
 * Implementa cálculos de ICMS, IPI, PIS, COFINS, Simples Nacional
 */

class TaxCalculationService {
  constructor() {
    // Tabelas de alíquotas do Simples Nacional 2024
    this.simplesNacionalAnexos = {
      I: [
        // Comércio
        { faixa: 180000, aliquota: 4.0, deducao: 0 },
        { faixa: 360000, aliquota: 7.3, deducao: 5940 },
        { faixa: 720000, aliquota: 9.5, deducao: 13860 },
        { faixa: 1800000, aliquota: 10.7, deducao: 22500 },
        { faixa: 3600000, aliquota: 14.3, deducao: 87300 },
        { faixa: 4800000, aliquota: 19.0, deducao: 378000 },
      ],
      II: [
        // Indústria
        { faixa: 180000, aliquota: 4.5, deducao: 0 },
        { faixa: 360000, aliquota: 7.8, deducao: 5940 },
        { faixa: 720000, aliquota: 10.0, deducao: 13860 },
        { faixa: 1800000, aliquota: 11.2, deducao: 22500 },
        { faixa: 3600000, aliquota: 14.7, deducao: 85500 },
        { faixa: 4800000, aliquota: 30.0, deducao: 720000 },
      ],
      III: [
        // Serviços
        { faixa: 180000, aliquota: 6.0, deducao: 0 },
        { faixa: 360000, aliquota: 11.2, deducao: 9360 },
        { faixa: 720000, aliquota: 13.5, deducao: 17640 },
        { faixa: 1800000, aliquota: 16.0, deducao: 35640 },
        { faixa: 3600000, aliquota: 21.0, deducao: 125640 },
        { faixa: 4800000, aliquota: 33.0, deducao: 648000 },
      ],
    };

    // Alíquotas de ICMS por UF (alíquota interna padrão)
    this.aliquotasICMS = {
      AC: 17,
      AL: 17,
      AP: 18,
      AM: 18,
      BA: 18,
      CE: 18,
      DF: 18,
      ES: 17,
      GO: 17,
      MA: 18,
      MT: 17,
      MS: 17,
      MG: 18,
      PA: 17,
      PB: 18,
      PR: 18,
      PE: 18,
      PI: 18,
      RJ: 18,
      RN: 18,
      RS: 18,
      RO: 17.5,
      RR: 17,
      SC: 17,
      SP: 18,
      SE: 18,
      TO: 18,
    };

    // Alíquotas de PIS/COFINS
    this.aliquotasPISCOFINS = {
      lucroReal: { pis: 1.65, cofins: 7.6 },
      lucroPresumido: { pis: 0.65, cofins: 3.0 },
      simplesNacional: { pis: 0, cofins: 0 }, // Incluído no DAS
    };
  }

  // ==================== SIMPLES NACIONAL ====================

  calcularSimplesNacional(faturamento12Meses, anexo, valorVenda) {
    if (!this.simplesNacionalAnexos[anexo]) {
      throw new Error(`Anexo ${anexo} não encontrado`);
    }

    const tabela = this.simplesNacionalAnexos[anexo];
    let faixaEncontrada = null;

    // Encontrar a faixa correta
    for (const faixa of tabela) {
      if (faturamento12Meses <= faixa.faixa) {
        faixaEncontrada = faixa;
        break;
      }
    }

    if (!faixaEncontrada) {
      throw new Error("Faturamento excede o limite do Simples Nacional");
    }

    // Calcular alíquota efetiva
    const aliquotaEfetiva =
      (((faturamento12Meses * faixaEncontrada.aliquota) / 100 -
        faixaEncontrada.deducao) /
        faturamento12Meses) *
      100;

    // Calcular impostos
    const valorImpostos = (valorVenda * aliquotaEfetiva) / 100;

    return {
      anexo,
      faixa: faixaEncontrada.faixa,
      aliquotaNominal: faixaEncontrada.aliquota,
      aliquotaEfetiva: parseFloat(aliquotaEfetiva.toFixed(4)),
      valorImpostos: parseFloat(valorImpostos.toFixed(2)),
      detalhamento: this.detalharSimplesNacional(
        anexo,
        aliquotaEfetiva,
        valorVenda,
      ),
    };
  }

  detalharSimplesNacional(anexo, aliquotaEfetiva, valorVenda) {
    // Distribuição aproximada dos impostos no Simples Nacional
    const distribuicao = {
      I: {
        // Comércio
        irpj: 5.5,
        csll: 3.5,
        cofins: 12.74,
        pis: 2.76,
        cpp: 41.5,
        icms: 34.0,
      },
      II: {
        // Indústria
        irpj: 5.5,
        csll: 3.5,
        cofins: 12.74,
        pis: 2.76,
        cpp: 41.5,
        icms: 32.0,
        ipi: 2.0,
      },
      III: {
        // Serviços
        irpj: 4.0,
        csll: 3.5,
        cofins: 12.82,
        pis: 2.78,
        cpp: 43.4,
        iss: 33.5,
      },
    };

    const dist = distribuicao[anexo];
    const valorTotal = (valorVenda * aliquotaEfetiva) / 100;

    const detalhes = {};
    for (const [imposto, percentual] of Object.entries(dist)) {
      detalhes[imposto] = parseFloat(
        ((valorTotal * percentual) / 100).toFixed(2),
      );
    }

    return detalhes;
  }

  // ==================== ICMS ====================

  calcularICMS(
    valorProduto,
    ufOrigem,
    ufDestino,
    cst,
    aliquotaReduzida = null,
  ) {
    let aliquota = 0;
    let baseCalculo = valorProduto;
    let valorICMS = 0;

    switch (cst) {
      case "00": // Tributada integralmente
        if (ufOrigem === ufDestino) {
          aliquota = this.aliquotasICMS[ufOrigem] || 18;
        } else {
          aliquota = this.calcularAliquotaInterestadual(ufOrigem, ufDestino);
        }
        valorICMS = (baseCalculo * aliquota) / 100;
        break;

      case "10": // Tributada com cobrança do ICMS por substituição tributária
        aliquota = this.aliquotasICMS[ufOrigem] || 18;
        valorICMS = (baseCalculo * aliquota) / 100;
        // TODO: Implementar cálculo de ST
        break;

      case "20": // Com redução de base de cálculo
        if (aliquotaReduzida) {
          baseCalculo = valorProduto * (1 - aliquotaReduzida / 100);
          aliquota = this.aliquotasICMS[ufOrigem] || 18;
          valorICMS = (baseCalculo * aliquota) / 100;
        }
        break;

      case "30": // Isenta ou não tributada com cobrança do ICMS por substituição tributária
        valorICMS = 0;
        // TODO: Implementar cálculo de ST
        break;

      case "40": // Isenta
      case "41": // Não tributada
      case "50": // Suspensão
        valorICMS = 0;
        aliquota = 0;
        break;

      case "51": // Diferimento
        // TODO: Implementar cálculo de diferimento
        valorICMS = 0;
        break;

      case "60": // ICMS cobrado anteriormente por substituição tributária
        valorICMS = 0;
        break;

      case "70": // Com redução de base de cálculo e cobrança do ICMS por substituição tributária
        if (aliquotaReduzida) {
          baseCalculo = valorProduto * (1 - aliquotaReduzida / 100);
          aliquota = this.aliquotasICMS[ufOrigem] || 18;
          valorICMS = (baseCalculo * aliquota) / 100;
        }
        // TODO: Implementar cálculo de ST
        break;

      case "90": // Outras
        aliquota = this.aliquotasICMS[ufOrigem] || 18;
        valorICMS = (baseCalculo * aliquota) / 100;
        break;

      default:
        throw new Error(`CST ${cst} não implementado`);
    }

    return {
      cst,
      baseCalculo: parseFloat(baseCalculo.toFixed(2)),
      aliquota: parseFloat(aliquota.toFixed(2)),
      valorICMS: parseFloat(valorICMS.toFixed(2)),
    };
  }

  calcularAliquotaInterestadual(ufOrigem, ufDestino) {
    // Alíquotas interestaduais padrão
    const regioesSulSudeste = ["SP", "RJ", "MG", "ES", "PR", "SC", "RS"];

    if (
      regioesSulSudeste.includes(ufOrigem) &&
      regioesSulSudeste.includes(ufDestino)
    ) {
      return 12; // Sul/Sudeste para Sul/Sudeste
    } else {
      return 7; // Demais operações interestaduais
    }
  }

  // ==================== IPI ====================

  calcularIPI(valorProduto, cst, aliquota = 0) {
    let baseCalculo = valorProduto;
    let valorIPI = 0;

    switch (cst) {
      case "00": // Entrada com recuperação de crédito
      case "49": // Outras entradas
      case "50": // Saída tributada
        valorIPI = (baseCalculo * aliquota) / 100;
        break;

      case "01": // Entrada tributada com alíquota zero
      case "02": // Entrada isenta
      case "03": // Entrada não tributada
      case "04": // Entrada imune
      case "05": // Entrada com suspensão
      case "51": // Saída tributada com alíquota zero
      case "52": // Saída isenta
      case "53": // Saída não tributada
      case "54": // Saída imune
      case "55": // Saída com suspensão
        valorIPI = 0;
        aliquota = 0;
        break;

      default:
        throw new Error(`CST de IPI ${cst} não implementado`);
    }

    return {
      cst,
      baseCalculo: parseFloat(baseCalculo.toFixed(2)),
      aliquota: parseFloat(aliquota.toFixed(2)),
      valorIPI: parseFloat(valorIPI.toFixed(2)),
    };
  }

  // ==================== PIS/COFINS ====================

  calcularPISCOFINS(valorProduto, cst, regimeTributario = "lucroReal") {
    const aliquotas = this.aliquotasPISCOFINS[regimeTributario];
    let baseCalculo = valorProduto;
    let valorPIS = 0;
    let valorCOFINS = 0;

    switch (cst) {
      case "01": // Operação tributável com alíquota básica
      case "02": // Operação tributável com alíquota diferenciada
        valorPIS = (baseCalculo * aliquotas.pis) / 100;
        valorCOFINS = (baseCalculo * aliquotas.cofins) / 100;
        break;

      case "03": // Operação tributável com alíquota por unidade de medida de produto
        // TODO: Implementar cálculo por unidade
        break;

      case "04": // Operação tributável monofásica
      case "05": // Operação tributável por substituição tributária
      case "06": // Operação tributável a alíquota zero
      case "07": // Operação isenta da contribuição
      case "08": // Operação sem incidência da contribuição
      case "09": // Operação com suspensão da contribuição
        valorPIS = 0;
        valorCOFINS = 0;
        break;

      case "49": // Outras operações de saída
      case "50": // Operação com direito a crédito - Vinculada exclusivamente a receita tributada no mercado interno
      case "51": // Operação com direito a crédito - Vinculada exclusivamente a receita não tributada no mercado interno
      case "52": // Operação com direito a crédito - Vinculada exclusivamente a receita de exportação
      case "53": // Operação com direito a crédito - Vinculada a receitas tributadas e não-tributadas no mercado interno
      case "54": // Operação com direito a crédito - Vinculada a receitas tributadas no mercado interno e de exportação
      case "55": // Operação com direito a crédito - Vinculada a receitas não-tributadas no mercado interno e de exportação
      case "56": // Operação com direito a crédito - Vinculada a receitas tributadas e não-tributadas no mercado interno, e de exportação
      case "60": // Crédito presumido - Operação de aquisição vinculada exclusivamente a receita tributada no mercado interno
      case "61": // Crédito presumido - Operação de aquisição vinculada exclusivamente a receita não-tributada no mercado interno
      case "62": // Crédito presumido - Operação de aquisição vinculada exclusivamente a receita de exportação
      case "63": // Crédito presumido - Operação de aquisição vinculada a receitas tributadas e não-tributadas no mercado interno
      case "64": // Crédito presumido - Operação de aquisição vinculada a receitas tributadas no mercado interno e de exportação
      case "65": // Crédito presumido - Operação de aquisição vinculada a receitas não-tributadas no mercado interno e de exportação
      case "66": // Crédito presumido - Operação de aquisição vinculada a receitas tributadas e não-tributadas no mercado interno, e de exportação
      case "67": // Crédito presumido - Outras operações
      case "70": // Operação de aquisição sem direito a crédito
      case "71": // Operação de aquisição com isenção
      case "72": // Operação de aquisição com suspensão
      case "73": // Operação de aquisição a alíquota zero
      case "74": // Operação de aquisição sem incidência da contribuição
      case "75": // Operação de aquisição por substituição tributária
      case "98": // Outras operações de entrada
      case "99": // Outras operações
        valorPIS = (baseCalculo * aliquotas.pis) / 100;
        valorCOFINS = (baseCalculo * aliquotas.cofins) / 100;
        break;

      default:
        throw new Error(`CST de PIS/COFINS ${cst} não implementado`);
    }

    return {
      pis: {
        cst,
        baseCalculo: parseFloat(baseCalculo.toFixed(2)),
        aliquota: parseFloat(aliquotas.pis.toFixed(2)),
        valor: parseFloat(valorPIS.toFixed(2)),
      },
      cofins: {
        cst,
        baseCalculo: parseFloat(baseCalculo.toFixed(2)),
        aliquota: parseFloat(aliquotas.cofins.toFixed(2)),
        valor: parseFloat(valorCOFINS.toFixed(2)),
      },
    };
  }

  // ==================== CÁLCULO COMPLETO ====================

  calcularImpostosCompleto(produto, configuracao) {
    const {
      valor,
      quantidade = 1,
      ufOrigem,
      ufDestino,
      regimeTributario = "simplesNacional",
      anexoSimples = "I",
      faturamento12Meses = 0,
      cstICMS = "00",
      cstIPI = "53",
      cstPIS = "07",
      aliquotaIPI = 0,
      aliquotaReducaoICMS = null,
    } = produto;

    const valorTotal = valor * quantidade;
    const resultado = {
      valorProduto: parseFloat(valorTotal.toFixed(2)),
      impostos: {},
      totalImpostos: 0,
      valorLiquido: 0,
    };

    try {
      // Simples Nacional
      if (regimeTributario === "simplesNacional") {
        resultado.impostos.simplesNacional = this.calcularSimplesNacional(
          faturamento12Meses,
          anexoSimples,
          valorTotal,
        );
        resultado.totalImpostos +=
          resultado.impostos.simplesNacional.valorImpostos;
      } else {
        // Regime normal - calcular impostos separadamente

        // ICMS
        resultado.impostos.icms = this.calcularICMS(
          valorTotal,
          ufOrigem,
          ufDestino,
          cstICMS,
          aliquotaReducaoICMS,
        );
        resultado.totalImpostos += resultado.impostos.icms.valorICMS;

        // IPI
        resultado.impostos.ipi = this.calcularIPI(
          valorTotal,
          cstIPI,
          aliquotaIPI,
        );
        resultado.totalImpostos += resultado.impostos.ipi.valorIPI;

        // PIS/COFINS
        resultado.impostos.pisCofins = this.calcularPISCOFINS(
          valorTotal,
          cstPIS,
          regimeTributario,
        );
        resultado.totalImpostos += resultado.impostos.pisCofins.pis.valor;
        resultado.totalImpostos += resultado.impostos.pisCofins.cofins.valor;
      }

      resultado.totalImpostos = parseFloat(resultado.totalImpostos.toFixed(2));
      resultado.valorLiquido = parseFloat(
        (valorTotal - resultado.totalImpostos).toFixed(2),
      );
    } catch (error) {
      throw new Error(`Erro no cálculo de impostos: ${error.message}`);
    }

    return resultado;
  }

  // ==================== UTILITÁRIOS ====================

  obterAliquotaICMS(uf) {
    return this.aliquotasICMS[uf] || 18;
  }

  verificarLimiteSimplesNacional(faturamento12Meses) {
    return faturamento12Meses <= 4800000;
  }

  calcularMargemLucro(valorCusto, valorVenda) {
    if (valorCusto <= 0 || valorVenda <= 0) {
      return 0;
    }
    return ((valorVenda - valorCusto) / valorVenda) * 100;
  }

  calcularMarkup(valorCusto, margemDesejada) {
    if (valorCusto <= 0 || margemDesejada <= 0) {
      return valorCusto;
    }
    return valorCusto / (1 - margemDesejada / 100);
  }

  // ==================== RELATÓRIOS ====================

  gerarRelatorioTributario(produtos, configuracao) {
    const relatorio = {
      configuracao,
      produtos: [],
      resumo: {
        valorTotalProdutos: 0,
        totalImpostos: 0,
        valorLiquido: 0,
        impostosPorTipo: {},
      },
    };

    for (const produto of produtos) {
      const calculo = this.calcularImpostosCompleto(produto, configuracao);
      relatorio.produtos.push({
        produto,
        calculo,
      });

      relatorio.resumo.valorTotalProdutos += calculo.valorProduto;
      relatorio.resumo.totalImpostos += calculo.totalImpostos;
      relatorio.resumo.valorLiquido += calculo.valorLiquido;

      // Agrupar impostos por tipo
      for (const [tipo, imposto] of Object.entries(calculo.impostos)) {
        if (!relatorio.resumo.impostosPorTipo[tipo]) {
          relatorio.resumo.impostosPorTipo[tipo] = 0;
        }

        if (tipo === "simplesNacional") {
          relatorio.resumo.impostosPorTipo[tipo] += imposto.valorImpostos;
        } else if (tipo === "icms") {
          relatorio.resumo.impostosPorTipo[tipo] += imposto.valorICMS;
        } else if (tipo === "ipi") {
          relatorio.resumo.impostosPorTipo[tipo] += imposto.valorIPI;
        } else if (tipo === "pisCofins") {
          relatorio.resumo.impostosPorTipo.pis =
            (relatorio.resumo.impostosPorTipo.pis || 0) + imposto.pis.valor;
          relatorio.resumo.impostosPorTipo.cofins =
            (relatorio.resumo.impostosPorTipo.cofins || 0) +
            imposto.cofins.valor;
        }
      }
    }

    // Arredondar valores do resumo
    relatorio.resumo.valorTotalProdutos = parseFloat(
      relatorio.resumo.valorTotalProdutos.toFixed(2),
    );
    relatorio.resumo.totalImpostos = parseFloat(
      relatorio.resumo.totalImpostos.toFixed(2),
    );
    relatorio.resumo.valorLiquido = parseFloat(
      relatorio.resumo.valorLiquido.toFixed(2),
    );

    for (const [tipo, valor] of Object.entries(
      relatorio.resumo.impostosPorTipo,
    )) {
      relatorio.resumo.impostosPorTipo[tipo] = parseFloat(valor.toFixed(2));
    }

    return relatorio;
  }
}

module.exports = { TaxCalculationService };
