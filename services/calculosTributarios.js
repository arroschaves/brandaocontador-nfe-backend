/**
 * Serviço de Cálculos Tributários Automáticos
 * Suporte para Simples Nacional, Lucro Presumido/Real, Substituição Tributária
 * Preparado para IBS/CBS/IS 2026
 */

class CalculosTributariosService {
  constructor() {
    // Tabelas de alíquotas Simples Nacional 2025
    this.aliquotasSimples = {
      comercio: [
        {
          faixa: 180000,
          aliquota: 4.0,
          icms: 1.25,
          irpj: 0.0,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 0.0,
        },
        {
          faixa: 360000,
          aliquota: 7.3,
          icms: 1.86,
          irpj: 0.0,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 2.69,
        },
        {
          faixa: 720000,
          aliquota: 9.5,
          icms: 2.33,
          irpj: 0.24,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 4.18,
        },
        {
          faixa: 1800000,
          aliquota: 10.7,
          icms: 2.56,
          irpj: 0.27,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 5.12,
        },
        {
          faixa: 3600000,
          aliquota: 14.3,
          icms: 2.33,
          irpj: 0.35,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 8.87,
        },
        {
          faixa: 4800000,
          aliquota: 19.0,
          icms: 2.33,
          irpj: 0.35,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 13.57,
        },
      ],
      industria: [
        {
          faixa: 180000,
          aliquota: 4.5,
          icms: 1.25,
          irpj: 0.0,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 0.5,
        },
        {
          faixa: 360000,
          aliquota: 7.8,
          icms: 1.86,
          irpj: 0.0,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 3.19,
        },
        {
          faixa: 720000,
          aliquota: 10.0,
          icms: 2.33,
          irpj: 0.24,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 4.68,
        },
        {
          faixa: 1800000,
          aliquota: 11.2,
          icms: 2.56,
          irpj: 0.27,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 5.62,
        },
        {
          faixa: 3600000,
          aliquota: 14.7,
          icms: 2.33,
          irpj: 0.35,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 9.27,
        },
        {
          faixa: 4800000,
          aliquota: 30.0,
          icms: 2.33,
          irpj: 0.35,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 2.75,
          ipi: 24.57,
        },
      ],
      servicos: [
        {
          faixa: 180000,
          aliquota: 6.0,
          iss: 2.0,
          irpj: 0.0,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 4.0,
        },
        {
          faixa: 360000,
          aliquota: 11.2,
          iss: 3.5,
          irpj: 0.0,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 7.7,
        },
        {
          faixa: 720000,
          aliquota: 13.5,
          iss: 4.0,
          irpj: 0.16,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 9.34,
        },
        {
          faixa: 1800000,
          aliquota: 16.0,
          iss: 4.0,
          irpj: 0.52,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 11.48,
        },
        {
          faixa: 3600000,
          aliquota: 21.0,
          iss: 4.0,
          irpj: 0.89,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 16.11,
        },
        {
          faixa: 4800000,
          aliquota: 33.0,
          iss: 4.0,
          irpj: 1.42,
          csll: 0.0,
          cofins: 0.0,
          pis: 0.0,
          cpp: 27.58,
        },
      ],
    };

    // Alíquotas ICMS por UF (2025)
    this.aliquotasICMS = {
      AC: { interna: 17.0, interestadual: 12.0 },
      AL: { interna: 17.0, interestadual: 12.0 },
      AP: { interna: 18.0, interestadual: 12.0 },
      AM: { interna: 18.0, interestadual: 12.0 },
      BA: { interna: 18.0, interestadual: 12.0 },
      CE: { interna: 18.0, interestadual: 12.0 },
      DF: { interna: 18.0, interestadual: 12.0 },
      ES: { interna: 17.0, interestadual: 12.0 },
      GO: { interna: 17.0, interestadual: 12.0 },
      MA: { interna: 18.0, interestadual: 12.0 },
      MT: { interna: 17.0, interestadual: 12.0 },
      MS: { interna: 17.0, interestadual: 12.0 },
      MG: { interna: 18.0, interestadual: 12.0 },
      PA: { interna: 17.0, interestadual: 12.0 },
      PB: { interna: 18.0, interestadual: 12.0 },
      PR: { interna: 18.0, interestadual: 12.0 },
      PE: { interna: 18.0, interestadual: 12.0 },
      PI: { interna: 18.0, interestadual: 12.0 },
      RJ: { interna: 20.0, interestadual: 12.0 },
      RN: { interna: 18.0, interestadual: 12.0 },
      RS: { interna: 18.0, interestadual: 12.0 },
      RO: { interna: 17.5, interestadual: 12.0 },
      RR: { interna: 17.0, interestadual: 12.0 },
      SC: { interna: 17.0, interestadual: 12.0 },
      SP: { interna: 18.0, interestadual: 12.0 },
      SE: { interna: 18.0, interestadual: 12.0 },
      TO: { interna: 18.0, interestadual: 12.0 },
    };

    // Alíquotas PIS/COFINS
    this.aliquotasPisCofins = {
      lucroReal: { pis: 1.65, cofins: 7.6 },
      lucroPresumido: { pis: 0.65, cofins: 3.0 },
      simplesNacional: { pis: 0.0, cofins: 0.0 }, // Incluído no DAS
    };

    // Preparação para IBS/CBS/IS 2026 (facultativo em 2025)
    this.aliquotas2026 = {
      ibs: 8.8, // Imposto sobre Bens e Serviços
      cbs: 8.8, // Contribuição sobre Bens e Serviços
      is: 1.0, // Imposto Seletivo (produtos específicos)
      creditoIntegral: true, // Crédito integral na cadeia
    };
  }

  /**
   * Calcular impostos para Simples Nacional
   */
  calcularSimplesNacional(dados) {
    const {
      faturamento12Meses,
      valorProdutos,
      uf,
      tipoAtividade = "comercio",
    } = dados;

    const faixas =
      this.aliquotasSimples[tipoAtividade] || this.aliquotasSimples.comercio;
    let faixaAtual = faixas[0];

    for (const faixa of faixas) {
      if (faturamento12Meses <= faixa.faixa) {
        faixaAtual = faixa;
        break;
      }
    }

    const resultados = [];
    let totalImpostos = 0;

    for (const produto of valorProdutos) {
      const valorTotal = produto.quantidade * produto.valorUnitario;
      const aliquotaEfetiva = faixaAtual.aliquota / 100;
      const valorDAS = valorTotal * aliquotaEfetiva;

      // Partilha do ICMS (apenas para comércio/indústria)
      let icmsPartilha = 0;
      if (tipoAtividade !== "servicos" && faixaAtual.icms) {
        icmsPartilha = valorTotal * (faixaAtual.icms / 100);
      }

      const impostos = {
        das: valorDAS,
        icmsPartilha: icmsPartilha,
        aliquotaEfetiva: faixaAtual.aliquota,
        faixaFaturamento: faixaAtual.faixa,
        observacoes: this.gerarObservacoesSimplesNacional(
          faixaAtual,
          tipoAtividade,
        ),
      };

      totalImpostos += valorDAS;

      resultados.push({
        produto: produto.descricao,
        valorTotal,
        impostos,
      });
    }

    return {
      regime: "Simples Nacional",
      faixaAtual: faixaAtual.faixa,
      aliquotaEfetiva: faixaAtual.aliquota,
      totalImpostos,
      produtos: resultados,
      observacoesGerais: `Empresa enquadrada no Simples Nacional. Faturamento 12 meses: R$ ${faturamento12Meses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    };
  }

  /**
   * Calcular impostos para Lucro Presumido/Real
   */
  calcularLucroPresumidoReal(dados) {
    const {
      valorProdutos,
      uf,
      ufDestino,
      tipoRegime = "presumido",
      tipoOperacao = "venda",
    } = dados;

    const resultados = [];
    let totalImpostos = 0;

    for (const produto of valorProdutos) {
      const valorTotal = produto.quantidade * produto.valorUnitario;

      // ICMS
      const aliquotaICMS = this.calcularAliquotaICMS(
        uf,
        ufDestino,
        tipoOperacao,
      );
      const valorICMS = valorTotal * (aliquotaICMS / 100);

      // PIS/COFINS
      const aliquotasPis =
        this.aliquotasPisCofins[
          tipoRegime === "presumido" ? "lucroPresumido" : "lucroReal"
        ];
      const valorPIS = valorTotal * (aliquotasPis.pis / 100);
      const valorCOFINS = valorTotal * (aliquotasPis.cofins / 100);

      // IPI (se aplicável)
      let valorIPI = 0;
      if (produto.aliquotaIPI) {
        valorIPI = valorTotal * (produto.aliquotaIPI / 100);
      }

      const impostos = {
        icms: {
          valor: valorICMS,
          aliquota: aliquotaICMS,
          cst: this.determinarCSTICMS(uf, ufDestino, tipoOperacao),
        },
        pis: {
          valor: valorPIS,
          aliquota: aliquotasPis.pis,
          cst: tipoRegime === "presumido" ? "01" : "01",
        },
        cofins: {
          valor: valorCOFINS,
          aliquota: aliquotasPis.cofins,
          cst: tipoRegime === "presumido" ? "01" : "01",
        },
        ipi: produto.aliquotaIPI
          ? {
              valor: valorIPI,
              aliquota: produto.aliquotaIPI,
              cst: "50",
            }
          : null,
        observacoes: this.gerarObservacoesLucro(tipoRegime, uf, ufDestino),
      };

      const totalProduto = valorICMS + valorPIS + valorCOFINS + valorIPI;
      totalImpostos += totalProduto;

      resultados.push({
        produto: produto.descricao,
        valorTotal,
        impostos,
      });
    }

    return {
      regime: `Lucro ${tipoRegime === "presumido" ? "Presumido" : "Real"}`,
      totalImpostos,
      produtos: resultados,
      observacoesGerais: `Empresa tributada pelo Lucro ${tipoRegime === "presumido" ? "Presumido" : "Real"}. Operação: ${uf} → ${ufDestino}`,
    };
  }

  /**
   * Calcular Substituição Tributária
   */
  calcularSubstituicaoTributaria(dados) {
    const { valorProdutos, uf, ufDestino, mva = 30 } = dados; // MVA padrão 30%

    const resultados = [];
    let totalImpostos = 0;

    for (const produto of valorProdutos) {
      const valorTotal = produto.quantidade * produto.valorUnitario;

      // Base de cálculo ST
      const baseCalculoST = valorTotal * (1 + mva / 100);

      // ICMS próprio
      const aliquotaICMS = this.calcularAliquotaICMS(uf, ufDestino, "venda");
      const valorICMSProprio = valorTotal * (aliquotaICMS / 100);

      // ICMS ST
      const aliquotaICMSST = this.aliquotasICMS[ufDestino]?.interna || 18;
      const valorICMSST =
        baseCalculoST * (aliquotaICMSST / 100) - valorICMSProprio;

      const impostos = {
        icmsProprio: {
          valor: valorICMSProprio,
          aliquota: aliquotaICMS,
          baseCalculo: valorTotal,
        },
        icmsST: {
          valor: Math.max(0, valorICMSST),
          aliquota: aliquotaICMSST,
          baseCalculo: baseCalculoST,
          mva: mva,
        },
        observacoes: `Produto sujeito à Substituição Tributária. MVA: ${mva}%`,
      };

      const totalProduto = valorICMSProprio + Math.max(0, valorICMSST);
      totalImpostos += totalProduto;

      resultados.push({
        produto: produto.descricao,
        valorTotal,
        impostos,
      });
    }

    return {
      regime: "Substituição Tributária",
      mva,
      totalImpostos,
      produtos: resultados,
      observacoesGerais: `Operação com Substituição Tributária. MVA aplicada: ${mva}%`,
    };
  }

  /**
   * Simulador 2026 - IBS/CBS/IS
   */
  simular2026(dados) {
    const { valorProdutos, incluirIS = false } = dados;

    const resultados = [];
    let totalImpostos = 0;

    for (const produto of valorProdutos) {
      const valorTotal = produto.quantidade * produto.valorUnitario;

      // IBS (Imposto sobre Bens e Serviços)
      const valorIBS = valorTotal * (this.aliquotas2026.ibs / 100);

      // CBS (Contribuição sobre Bens e Serviços)
      const valorCBS = valorTotal * (this.aliquotas2026.cbs / 100);

      // IS (Imposto Seletivo) - apenas produtos específicos
      let valorIS = 0;
      if (incluirIS && produto.sujeitoIS) {
        valorIS = valorTotal * (this.aliquotas2026.is / 100);
      }

      const impostos = {
        ibs: {
          valor: valorIBS,
          aliquota: this.aliquotas2026.ibs,
          creditoIntegral: true,
        },
        cbs: {
          valor: valorCBS,
          aliquota: this.aliquotas2026.cbs,
          creditoIntegral: true,
        },
        is:
          incluirIS && produto.sujeitoIS
            ? {
                valor: valorIS,
                aliquota: this.aliquotas2026.is,
                creditoIntegral: false,
              }
            : null,
        observacoes: "Simulação Reforma Tributária 2026 - Valores estimados",
      };

      const totalProduto = valorIBS + valorCBS + valorIS;
      totalImpostos += totalProduto;

      resultados.push({
        produto: produto.descricao,
        valorTotal,
        impostos,
      });
    }

    return {
      regime: "Reforma Tributária 2026",
      totalImpostos,
      produtos: resultados,
      observacoesGerais:
        "Simulação baseada na Reforma Tributária. Valores sujeitos a alterações até a implementação final.",
      beneficios: [
        "Crédito integral na cadeia produtiva",
        "Simplificação tributária",
        "Redução da cumulatividade",
        "Maior transparência fiscal",
      ],
    };
  }

  /**
   * Métodos auxiliares
   */
  calcularAliquotaICMS(ufOrigem, ufDestino, tipoOperacao) {
    if (ufOrigem === ufDestino) {
      return this.aliquotasICMS[ufOrigem]?.interna || 18;
    } else {
      return this.aliquotasICMS[ufOrigem]?.interestadual || 12;
    }
  }

  determinarCSTICMS(ufOrigem, ufDestino, tipoOperacao) {
    if (ufOrigem === ufDestino) {
      return "00"; // Tributada integralmente
    } else {
      return "00"; // Tributada integralmente interestadual
    }
  }

  gerarObservacoesSimplesNacional(faixa, tipoAtividade) {
    return [
      `Empresa optante pelo Simples Nacional`,
      `Atividade: ${tipoAtividade}`,
      `Alíquota efetiva: ${faixa.aliquota}%`,
      `Faixa de faturamento: até R$ ${faixa.faixa.toLocaleString("pt-BR")}`,
    ];
  }

  gerarObservacoesLucro(tipoRegime, ufOrigem, ufDestino) {
    const observacoes = [
      `Empresa tributada pelo Lucro ${tipoRegime === "presumido" ? "Presumido" : "Real"}`,
      `Operação: ${ufOrigem} → ${ufDestino}`,
    ];

    if (ufOrigem !== ufDestino) {
      observacoes.push("Operação interestadual - ICMS 12%");
    }

    return observacoes;
  }

  /**
   * Comparativo entre regimes
   */
  compararRegimes(dados) {
    const simplesNacional = this.calcularSimplesNacional(dados);
    const lucroPresumido = this.calcularLucroPresumidoReal({
      ...dados,
      tipoRegime: "presumido",
    });
    const lucroReal = this.calcularLucroPresumidoReal({
      ...dados,
      tipoRegime: "real",
    });
    const simulacao2026 = this.simular2026(dados);

    return {
      simplesNacional,
      lucroPresumido,
      lucroReal,
      simulacao2026,
      melhorOpcao: this.determinarMelhorRegime([
        simplesNacional,
        lucroPresumido,
        lucroReal,
      ]),
      economia2026:
        simulacao2026.totalImpostos < simplesNacional.totalImpostos
          ? simplesNacional.totalImpostos - simulacao2026.totalImpostos
          : 0,
    };
  }

  determinarMelhorRegime(regimes) {
    return regimes.reduce((melhor, atual) =>
      atual.totalImpostos < melhor.totalImpostos ? atual : melhor,
    );
  }
}

module.exports = CalculosTributariosService;
