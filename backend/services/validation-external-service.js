const axios = require('axios');

/**
 * Serviço de Validação Externa
 * Integra APIs gratuitas para validação de CNPJ/CPF e consulta de CEP
 * 
 * APIs utilizadas:
 * - BrasilAPI: https://brasilapi.com.br/ (CNPJ, CEP, Estados, Cidades)
 * - ViaCEP: https://viacep.com.br/ (CEP - fallback)
 * - ReceitaWS: https://www.receitaws.com.br/ (CNPJ - fallback)
 */
class ValidationExternalService {
  constructor() {
    this.timeout = 10000; // 10 segundos
    this.retries = 2;
    
    // URLs das APIs
    this.apis = {
      brasilapi: {
        base: 'https://brasilapi.com.br/api',
        cnpj: '/cnpj/v1',
        cep: '/cep/v1',
        estados: '/ibge/uf/v1',
        municipios: '/ibge/municipios/v1'
      },
      viacep: {
        base: 'https://viacep.com.br/ws',
        cep: '/{cep}/json'
      },
      receitaws: {
        base: 'https://www.receitaws.com.br/v1',
        cnpj: '/cnpj'
      }
    };
    
    // Cache para evitar consultas desnecessárias
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Valida formato de CPF
   */
  validarFormatoCPF(cpf) {
    if (!cpf) return false;
    
    // Remove caracteres não numéricos
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos
    if (cpfLimpo.length !== 11) return false;
    
    // Verifica se não são todos iguais
    if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;
    
    // Validação dos dígitos verificadores
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let digito1 = resto < 2 ? 0 : resto;
    
    if (parseInt(cpfLimpo.charAt(9)) !== digito1) return false;
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let digito2 = resto < 2 ? 0 : resto;
    
    return parseInt(cpfLimpo.charAt(10)) === digito2;
  }

  /**
   * Valida formato de CNPJ
   */
  validarFormatoCNPJ(cnpj) {
    if (!cnpj) return false;
    
    // Remove caracteres não numéricos
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    // Verifica se tem 14 dígitos
    if (cnpjLimpo.length !== 14) return false;
    
    // Verifica se não são todos iguais
    if (/^(\d)\1{13}$/.test(cnpjLimpo)) return false;
    
    // Validação dos dígitos verificadores
    let tamanho = cnpjLimpo.length - 2;
    let numeros = cnpjLimpo.substring(0, tamanho);
    let digitos = cnpjLimpo.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    
    tamanho = tamanho + 1;
    numeros = cnpjLimpo.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    return resultado === parseInt(digitos.charAt(1));
  }

  /**
   * Consulta CNPJ na Receita Federal via BrasilAPI
   */
  async consultarCNPJ(cnpj) {
    try {
      // Valida formato primeiro
      if (!this.validarFormatoCNPJ(cnpj)) {
        throw new Error('CNPJ com formato inválido');
      }

      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const cacheKey = `cnpj_${cnpjLimpo}`;
      
      // Verifica cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      // Tenta BrasilAPI primeiro
      try {
        const response = await axios.get(
          `${this.apis.brasilapi.base}${this.apis.brasilapi.cnpj}/${cnpjLimpo}`,
          { timeout: this.timeout }
        );

        const dados = {
          cnpj: response.data.cnpj,
          razaoSocial: response.data.razao_social,
          nomeFantasia: response.data.nome_fantasia,
          situacao: response.data.descricao_situacao_cadastral,
          dataAbertura: response.data.data_inicio_atividade,
          naturezaJuridica: response.data.natureza_juridica,
          porte: response.data.porte,
          atividadePrincipal: response.data.cnae_fiscal_descricao,
          endereco: {
            logradouro: response.data.logradouro,
            numero: response.data.numero,
            complemento: response.data.complemento,
            bairro: response.data.bairro,
            municipio: response.data.municipio,
            uf: response.data.uf,
            cep: response.data.cep
          },
          telefone: response.data.ddd_telefone_1,
          email: response.data.email,
          fonte: 'BrasilAPI'
        };

        // Salva no cache
        this.cache.set(cacheKey, {
          data: dados,
          timestamp: Date.now()
        });

        return dados;
      } catch (brasilApiError) {
        console.warn('BrasilAPI falhou, tentando ReceitaWS:', brasilApiError.message);
        
        // Fallback para ReceitaWS
        const response = await axios.get(
          `${this.apis.receitaws.base}${this.apis.receitaws.cnpj}/${cnpjLimpo}`,
          { timeout: this.timeout }
        );

        if (response.data.status === 'ERROR') {
          throw new Error(response.data.message || 'CNPJ não encontrado');
        }

        const dados = {
          cnpj: response.data.cnpj,
          razaoSocial: response.data.nome,
          nomeFantasia: response.data.fantasia,
          situacao: response.data.situacao,
          dataAbertura: response.data.abertura,
          naturezaJuridica: response.data.natureza_juridica,
          porte: response.data.porte,
          atividadePrincipal: response.data.atividade_principal?.[0]?.text,
          endereco: {
            logradouro: response.data.logradouro,
            numero: response.data.numero,
            complemento: response.data.complemento,
            bairro: response.data.bairro,
            municipio: response.data.municipio,
            uf: response.data.uf,
            cep: response.data.cep
          },
          telefone: response.data.telefone,
          email: response.data.email,
          fonte: 'ReceitaWS'
        };

        // Salva no cache
        this.cache.set(cacheKey, {
          data: dados,
          timestamp: Date.now()
        });

        return dados;
      }
    } catch (error) {
      console.error('Erro ao consultar CNPJ:', error.message);
      throw new Error(`Erro ao consultar CNPJ: ${error.message}`);
    }
  }

  /**
   * Consulta CEP via BrasilAPI com fallback para ViaCEP
   */
  async consultarCEP(cep) {
    try {
      // Remove caracteres não numéricos
      const cepLimpo = cep.replace(/\D/g, '');
      
      // Valida formato
      if (cepLimpo.length !== 8) {
        throw new Error('CEP deve ter 8 dígitos');
      }

      const cacheKey = `cep_${cepLimpo}`;
      
      // Verifica cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      // Tenta BrasilAPI primeiro
      try {
        const response = await axios.get(
          `${this.apis.brasilapi.base}${this.apis.brasilapi.cep}/${cepLimpo}`,
          { timeout: this.timeout }
        );

        const dados = {
          cep: response.data.cep,
          logradouro: response.data.street,
          bairro: response.data.neighborhood,
          municipio: response.data.city,
          uf: response.data.state,
          ibge: response.data.city_ibge,
          fonte: 'BrasilAPI'
        };

        // Salva no cache
        this.cache.set(cacheKey, {
          data: dados,
          timestamp: Date.now()
        });

        return dados;
      } catch (brasilApiError) {
        console.warn('BrasilAPI falhou, tentando ViaCEP:', brasilApiError.message);
        
        // Fallback para ViaCEP
        const response = await axios.get(
          `${this.apis.viacep.base}/${cepLimpo}/json`,
          { timeout: this.timeout }
        );

        if (response.data.erro) {
          throw new Error('CEP não encontrado');
        }

        const dados = {
          cep: response.data.cep,
          logradouro: response.data.logradouro,
          bairro: response.data.bairro,
          municipio: response.data.localidade,
          uf: response.data.uf,
          ibge: response.data.ibge,
          fonte: 'ViaCEP'
        };

        // Salva no cache
        this.cache.set(cacheKey, {
          data: dados,
          timestamp: Date.now()
        });

        return dados;
      }
    } catch (error) {
      console.error('Erro ao consultar CEP:', error.message);
      throw new Error(`Erro ao consultar CEP: ${error.message}`);
    }
  }

  /**
   * Lista todos os estados brasileiros
   */
  async listarEstados() {
    try {
      const cacheKey = 'estados_brasil';
      
      // Verifica cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout * 12) { // Cache por 1 hora
          return cached.data;
        }
      }

      const response = await axios.get(
        `${this.apis.brasilapi.base}${this.apis.brasilapi.estados}`,
        { timeout: this.timeout }
      );

      const estados = response.data.map(estado => ({
        id: estado.id,
        sigla: estado.sigla,
        nome: estado.nome,
        regiao: estado.regiao.nome
      }));

      // Salva no cache
      this.cache.set(cacheKey, {
        data: estados,
        timestamp: Date.now()
      });

      return estados;
    } catch (error) {
      console.error('Erro ao listar estados:', error.message);
      throw new Error(`Erro ao listar estados: ${error.message}`);
    }
  }

  /**
   * Lista municípios por UF
   */
  async listarMunicipios(uf) {
    try {
      if (!uf || uf.length !== 2) {
        throw new Error('UF deve ter 2 caracteres');
      }

      const cacheKey = `municipios_${uf.toUpperCase()}`;
      
      // Verifica cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout * 12) { // Cache por 1 hora
          return cached.data;
        }
      }

      const response = await axios.get(
        `${this.apis.brasilapi.base}${this.apis.brasilapi.municipios}/${uf.toUpperCase()}`,
        { timeout: this.timeout }
      );

      const municipios = response.data.map(municipio => ({
        codigo_ibge: municipio.codigo_ibge,
        nome: municipio.nome
      }));

      // Salva no cache
      this.cache.set(cacheKey, {
        data: municipios,
        timestamp: Date.now()
      });

      return municipios;
    } catch (error) {
      console.error('Erro ao listar municípios:', error.message);
      throw new Error(`Erro ao listar municípios: ${error.message}`);
    }
  }

  /**
   * Valida e enriquece dados de cliente
   */
  async validarEEnriquecerCliente(dadosCliente) {
    try {
      const resultado = {
        valido: true,
        dados: { ...dadosCliente },
        erros: [],
        avisos: []
      };

      // Valida documento
      if (dadosCliente.tipo === 'cpf') {
        if (!this.validarFormatoCPF(dadosCliente.documento)) {
          resultado.valido = false;
          resultado.erros.push('CPF inválido');
        }
      } else if (dadosCliente.tipo === 'cnpj') {
        if (!this.validarFormatoCNPJ(dadosCliente.documento)) {
          resultado.valido = false;
          resultado.erros.push('CNPJ inválido');
        } else {
          // Enriquece dados do CNPJ
          try {
            const dadosCNPJ = await this.consultarCNPJ(dadosCliente.documento);
            resultado.dados.razaoSocial = dadosCNPJ.razaoSocial;
            resultado.dados.nomeFantasia = dadosCNPJ.nomeFantasia;
            resultado.dados.situacao = dadosCNPJ.situacao;
            resultado.dados.endereco = { ...resultado.dados.endereco, ...dadosCNPJ.endereco };
            resultado.avisos.push(`Dados obtidos da ${dadosCNPJ.fonte}`);
          } catch (error) {
            resultado.avisos.push('Não foi possível consultar dados do CNPJ na Receita Federal');
          }
        }
      }

      // Valida e enriquece CEP
      if (dadosCliente.endereco?.cep) {
        try {
          const dadosCEP = await this.consultarCEP(dadosCliente.endereco.cep);
          resultado.dados.endereco = {
            ...resultado.dados.endereco,
            cep: dadosCEP.cep,
            logradouro: dadosCEP.logradouro || resultado.dados.endereco.logradouro,
            bairro: dadosCEP.bairro || resultado.dados.endereco.bairro,
            cidade: dadosCEP.municipio || resultado.dados.endereco.cidade,
            uf: dadosCEP.uf || resultado.dados.endereco.uf,
            codigoIBGE: dadosCEP.ibge
          };
          resultado.avisos.push(`Endereço obtido via ${dadosCEP.fonte}`);
        } catch (error) {
          resultado.avisos.push('Não foi possível consultar o CEP informado');
        }
      }

      return resultado;
    } catch (error) {
      console.error('Erro ao validar cliente:', error.message);
      throw new Error(`Erro ao validar cliente: ${error.message}`);
    }
  }

  /**
   * Limpa cache
   */
  limparCache() {
    this.cache.clear();
  }

  /**
   * Estatísticas do cache
   */
  estatisticasCache() {
    return {
      tamanho: this.cache.size,
      entradas: Array.from(this.cache.keys())
    };
  }
}

module.exports = ValidationExternalService;