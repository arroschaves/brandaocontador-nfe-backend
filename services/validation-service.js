/**
 * Serviço de Validação Avançado
 * Validações de CNPJ, CPF, CEP e outros dados críticos
 */

const axios = require("axios");

class ValidationService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 horas
  }

  // ==================== VALIDAÇÃO DE CNPJ ====================

  validarCNPJ(cnpj) {
    if (!cnpj) return { valido: false, erro: "CNPJ não informado" };

    // Remover formatação
    const cnpjLimpo = cnpj.replace(/[^\d]/g, "");

    // Verificar tamanho
    if (cnpjLimpo.length !== 14) {
      return { valido: false, erro: "CNPJ deve ter 14 dígitos" };
    }

    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cnpjLimpo)) {
      return {
        valido: false,
        erro: "CNPJ inválido - todos os dígitos são iguais",
      };
    }

    // Validar dígitos verificadores
    const digitos = cnpjLimpo.split("").map(Number);

    // Primeiro dígito verificador
    let soma = 0;
    let peso = 5;
    for (let i = 0; i < 12; i++) {
      soma += digitos[i] * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    let resto = soma % 11;
    const dv1 = resto < 2 ? 0 : 11 - resto;

    if (digitos[12] !== dv1) {
      return {
        valido: false,
        erro: "CNPJ inválido - primeiro dígito verificador",
      };
    }

    // Segundo dígito verificador
    soma = 0;
    peso = 6;
    for (let i = 0; i < 13; i++) {
      soma += digitos[i] * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    resto = soma % 11;
    const dv2 = resto < 2 ? 0 : 11 - resto;

    if (digitos[13] !== dv2) {
      return {
        valido: false,
        erro: "CNPJ inválido - segundo dígito verificador",
      };
    }

    return {
      valido: true,
      cnpjFormatado: this.formatarCNPJ(cnpjLimpo),
      cnpjLimpo: cnpjLimpo,
    };
  }

  formatarCNPJ(cnpj) {
    const cnpjLimpo = cnpj.replace(/[^\d]/g, "");
    return cnpjLimpo.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    );
  }

  // ==================== VALIDAÇÃO DE CPF ====================

  validarCPF(cpf) {
    if (!cpf) return { valido: false, erro: "CPF não informado" };

    // Remover formatação
    const cpfLimpo = cpf.replace(/[^\d]/g, "");

    // Verificar tamanho
    if (cpfLimpo.length !== 11) {
      return { valido: false, erro: "CPF deve ter 11 dígitos" };
    }

    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpfLimpo)) {
      return {
        valido: false,
        erro: "CPF inválido - todos os dígitos são iguais",
      };
    }

    // Validar dígitos verificadores
    const digitos = cpfLimpo.split("").map(Number);

    // Primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += digitos[i] * (10 - i);
    }
    let resto = soma % 11;
    const dv1 = resto < 2 ? 0 : 11 - resto;

    if (digitos[9] !== dv1) {
      return {
        valido: false,
        erro: "CPF inválido - primeiro dígito verificador",
      };
    }

    // Segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += digitos[i] * (11 - i);
    }
    resto = soma % 11;
    const dv2 = resto < 2 ? 0 : 11 - resto;

    if (digitos[10] !== dv2) {
      return {
        valido: false,
        erro: "CPF inválido - segundo dígito verificador",
      };
    }

    return {
      valido: true,
      cpfFormatado: this.formatarCPF(cpfLimpo),
      cpfLimpo: cpfLimpo,
    };
  }

  formatarCPF(cpf) {
    const cpfLimpo = cpf.replace(/[^\d]/g, "");
    return cpfLimpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  // ==================== VALIDAÇÃO DE INSCRIÇÃO ESTADUAL ====================

  validarInscricaoEstadual(ie, uf) {
    if (!ie || ie.toUpperCase() === "ISENTO") {
      return { valido: true, isento: true };
    }

    const ieLimpa = ie.replace(/[^\d]/g, "");

    // Validações específicas por UF (implementação básica)
    const validacoes = {
      SP: this.validarIESP,
      RJ: this.validarIERJ,
      MG: this.validarIEMG,
      RS: this.validarIERS,
      PR: this.validarIEPR,
      SC: this.validarIESC,
    };

    const validador = validacoes[uf];
    if (validador) {
      return validador.call(this, ieLimpa);
    }

    // Validação genérica para outros estados
    return {
      valido: ieLimpa.length >= 8 && ieLimpa.length <= 14,
      erro:
        ieLimpa.length < 8 || ieLimpa.length > 14
          ? "Inscrição Estadual com tamanho inválido"
          : null,
    };
  }

  validarIESP(ie) {
    if (ie.length !== 12) {
      return { valido: false, erro: "IE de SP deve ter 12 dígitos" };
    }
    // Implementar validação específica de SP
    return { valido: true };
  }

  validarIERJ(ie) {
    if (ie.length !== 8) {
      return { valido: false, erro: "IE do RJ deve ter 8 dígitos" };
    }
    // Implementar validação específica do RJ
    return { valido: true };
  }

  validarIEMG(ie) {
    if (ie.length !== 13) {
      return { valido: false, erro: "IE de MG deve ter 13 dígitos" };
    }
    // Implementar validação específica de MG
    return { valido: true };
  }

  validarIERS(ie) {
    if (ie.length !== 10) {
      return { valido: false, erro: "IE do RS deve ter 10 dígitos" };
    }
    // Implementar validação específica do RS
    return { valido: true };
  }

  validarIEPR(ie) {
    if (ie.length !== 10) {
      return { valido: false, erro: "IE do PR deve ter 10 dígitos" };
    }
    // Implementar validação específica do PR
    return { valido: true };
  }

  validarIESC(ie) {
    if (ie.length !== 9) {
      return { valido: false, erro: "IE de SC deve ter 9 dígitos" };
    }
    // Implementar validação específica de SC
    return { valido: true };
  }

  // ==================== CONSULTA DE CEP ====================

  async consultarCEP(cep) {
    if (!cep) return { valido: false, erro: "CEP não informado" };

    const cepLimpo = cep.replace(/[^\d]/g, "");

    if (cepLimpo.length !== 8) {
      return { valido: false, erro: "CEP deve ter 8 dígitos" };
    }

    // Verificar cache
    const cacheKey = `cep_${cepLimpo}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Tentar múltiplas APIs de CEP
      const apis = [
        `https://viacep.com.br/ws/${cepLimpo}/json/`,
        `https://brasilapi.com.br/api/cep/v1/${cepLimpo}`,
        `https://cep.awesomeapi.com.br/json/${cepLimpo}`,
      ];

      for (const apiUrl of apis) {
        try {
          const response = await axios.get(apiUrl, { timeout: 5000 });

          if (response.data && !response.data.erro) {
            const endereco = this.normalizarEnderecoAPI(response.data, apiUrl);
            const resultado = { valido: true, endereco };

            this.setCache(cacheKey, resultado);
            return resultado;
          }
        } catch (error) {
          // Tentar próxima API
          continue;
        }
      }

      return { valido: false, erro: "CEP não encontrado" };
    } catch (error) {
      console.error("Erro ao consultar CEP:", error.message);
      return { valido: false, erro: "Erro ao consultar CEP" };
    }
  }

  normalizarEnderecoAPI(data, apiUrl) {
    if (apiUrl.includes("viacep")) {
      return {
        cep: data.cep,
        logradouro: data.logradouro,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
        ibge: data.ibge,
      };
    } else if (apiUrl.includes("brasilapi")) {
      return {
        cep: data.cep,
        logradouro: data.street,
        complemento: "",
        bairro: data.neighborhood,
        cidade: data.city,
        uf: data.state,
        ibge: data.city_ibge,
      };
    } else if (apiUrl.includes("awesomeapi")) {
      return {
        cep: data.cep,
        logradouro: data.address,
        complemento: "",
        bairro: data.district,
        cidade: data.city,
        uf: data.state,
        ibge: data.city_ibge,
      };
    }

    return data;
  }

  // ==================== VALIDAÇÃO DE EMAIL ====================

  validarEmail(email) {
    if (!email) return { valido: false, erro: "Email não informado" };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return { valido: false, erro: "Formato de email inválido" };
    }

    // Verificações adicionais
    if (email.length > 254) {
      return { valido: false, erro: "Email muito longo" };
    }

    const [local, domain] = email.split("@");

    if (local.length > 64) {
      return { valido: false, erro: "Parte local do email muito longa" };
    }

    if (domain.length > 253) {
      return { valido: false, erro: "Domínio do email muito longo" };
    }

    return { valido: true, emailNormalizado: email.toLowerCase() };
  }

  // ==================== VALIDAÇÃO DE TELEFONE ====================

  validarTelefone(telefone) {
    if (!telefone) return { valido: false, erro: "Telefone não informado" };

    const telefoneLimpo = telefone.replace(/[^\d]/g, "");

    // Telefone deve ter 10 ou 11 dígitos (com DDD)
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      return { valido: false, erro: "Telefone deve ter 10 ou 11 dígitos" };
    }

    // Verificar DDD válido (11 a 99)
    const ddd = parseInt(telefoneLimpo.substring(0, 2));
    if (ddd < 11 || ddd > 99) {
      return { valido: false, erro: "DDD inválido" };
    }

    return {
      valido: true,
      telefoneFormatado: this.formatarTelefone(telefoneLimpo),
      telefoneLimpo: telefoneLimpo,
    };
  }

  formatarTelefone(telefone) {
    const telefoneLimpo = telefone.replace(/[^\d]/g, "");

    if (telefoneLimpo.length === 10) {
      return telefoneLimpo.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    } else if (telefoneLimpo.length === 11) {
      return telefoneLimpo.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    }

    return telefone;
  }

  // ==================== CACHE ====================

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Limpar cache antigo periodicamente
    if (this.cache.size > 1000) {
      const now = Date.now();
      for (const [cacheKey, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.cache.delete(cacheKey);
        }
      }
    }
  }

  // ==================== VALIDAÇÃO COMPLETA DE CLIENTE ====================

  async validarCliente(dadosCliente) {
    const erros = [];
    const dadosValidados = {};

    // Validar tipo de pessoa
    if (!dadosCliente.tipo || !["F", "J"].includes(dadosCliente.tipo)) {
      erros.push("Tipo de pessoa deve ser F (Física) ou J (Jurídica)");
    } else {
      dadosValidados.tipo = dadosCliente.tipo;
    }

    // Validar documento
    if (dadosCliente.tipo === "F") {
      const cpfValidacao = this.validarCPF(dadosCliente.documento);
      if (!cpfValidacao.valido) {
        erros.push(cpfValidacao.erro);
      } else {
        dadosValidados.documento = cpfValidacao.cpfLimpo;
        dadosValidados.documentoFormatado = cpfValidacao.cpfFormatado;
      }
    } else if (dadosCliente.tipo === "J") {
      const cnpjValidacao = this.validarCNPJ(dadosCliente.documento);
      if (!cnpjValidacao.valido) {
        erros.push(cnpjValidacao.erro);
      } else {
        dadosValidados.documento = cnpjValidacao.cnpjLimpo;
        dadosValidados.documentoFormatado = cnpjValidacao.cnpjFormatado;
      }
    }

    // Validar email
    if (dadosCliente.email) {
      const emailValidacao = this.validarEmail(dadosCliente.email);
      if (!emailValidacao.valido) {
        erros.push(emailValidacao.erro);
      } else {
        dadosValidados.email = emailValidacao.emailNormalizado;
      }
    }

    // Validar telefone
    if (dadosCliente.telefone) {
      const telefoneValidacao = this.validarTelefone(dadosCliente.telefone);
      if (!telefoneValidacao.valido) {
        erros.push(telefoneValidacao.erro);
      } else {
        dadosValidados.telefone = telefoneValidacao.telefoneLimpo;
        dadosValidados.telefoneFormatado = telefoneValidacao.telefoneFormatado;
      }
    }

    // Validar CEP e buscar endereço
    if (dadosCliente.endereco?.cep) {
      const cepValidacao = await this.consultarCEP(dadosCliente.endereco.cep);
      if (!cepValidacao.valido) {
        erros.push(cepValidacao.erro);
      } else {
        dadosValidados.endereco = {
          ...dadosCliente.endereco,
          ...cepValidacao.endereco,
        };
      }
    }

    // Validar Inscrição Estadual (se pessoa jurídica)
    if (dadosCliente.tipo === "J" && dadosCliente.inscricaoEstadual) {
      const ieValidacao = this.validarInscricaoEstadual(
        dadosCliente.inscricaoEstadual,
        dadosCliente.endereco?.uf,
      );
      if (!ieValidacao.valido) {
        erros.push(ieValidacao.erro);
      } else {
        dadosValidados.inscricaoEstadual = dadosCliente.inscricaoEstadual;
        dadosValidados.ieIsento = ieValidacao.isento;
      }
    }

    return {
      valido: erros.length === 0,
      erros,
      dadosValidados,
    };
  }
}

module.exports = { ValidationService };
