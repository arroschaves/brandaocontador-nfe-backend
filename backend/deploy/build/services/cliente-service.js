const Cliente = require('../models/Cliente');
const ValidationExternalService = require('./validation-external-service');

/**
 * Serviço de Clientes
 * 
 * Gerencia operações CRUD de clientes com validação automática de:
 * - CNPJ/CPF via Receita Federal
 * - CEP via BrasilAPI/ViaCEP
 * - Enriquecimento automático de dados
 * - Estados e cidades brasileiras
 */
class ClienteService {
  constructor() {
    this.validationService = new ValidationExternalService();
  }

  // ==================== CRUD BÁSICO ====================

  /**
   * Criar novo cliente com validação completa
   */
  async criarCliente(dadosCliente, usuarioId) {
    try {
      console.log('👤 Criando novo cliente...');
      
      // Valida e enriquece dados
      const validacao = await this.validationService.validarEEnriquecerCliente(dadosCliente);
      
      if (!validacao.valido) {
        return {
          sucesso: false,
          erros: validacao.erros,
          avisos: validacao.avisos
        };
      }

      // Adiciona usuário responsável
      validacao.dados.usuarioId = usuarioId;

      // Cria cliente no banco
      const cliente = new Cliente(validacao.dados);
      await cliente.save();

      console.log('✅ Cliente criado com sucesso:', cliente._id);
      
      return {
        sucesso: true,
        cliente: cliente.toJSON(),
        avisos: validacao.avisos
      };

    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error.message);
      
      // Trata erros de duplicação
      if (error.code === 11000) {
        return {
          sucesso: false,
          erros: ['Cliente com este documento já existe']
        };
      }
      
      throw new Error(`Erro ao criar cliente: ${error.message}`);
    }
  }

  /**
   * Atualizar cliente existente
   */
  async atualizarCliente(clienteId, dadosAtualizacao, usuarioId) {
    try {
      console.log('👤 Atualizando cliente:', clienteId);

      // Busca cliente existente
      const clienteExistente = await Cliente.findOne({ 
        _id: clienteId, 
        usuarioId 
      });

      if (!clienteExistente) {
        return {
          sucesso: false,
          erros: ['Cliente não encontrado']
        };
      }

      // Se mudou documento, revalida
      if (dadosAtualizacao.documento && dadosAtualizacao.documento !== clienteExistente.documento) {
        const validacao = await this.validationService.validarEEnriquecerCliente({
          ...clienteExistente.toObject(),
          ...dadosAtualizacao
        });

        if (!validacao.valido) {
          return {
            sucesso: false,
            erros: validacao.erros,
            avisos: validacao.avisos
          };
        }

        dadosAtualizacao = validacao.dados;
      }

      // Atualiza cliente
      const clienteAtualizado = await Cliente.findByIdAndUpdate(
        clienteId,
        { $set: dadosAtualizacao },
        { new: true, runValidators: true }
      );

      console.log('✅ Cliente atualizado com sucesso');
      
      return {
        sucesso: true,
        cliente: clienteAtualizado.toJSON()
      };

    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error.message);
      
      if (error.code === 11000) {
        return {
          sucesso: false,
          erros: ['Cliente com este documento já existe']
        };
      }
      
      throw new Error(`Erro ao atualizar cliente: ${error.message}`);
    }
  }

  /**
   * Buscar cliente por ID
   */
  async buscarClientePorId(clienteId, usuarioId) {
    try {
      const cliente = await Cliente.findOne({ 
        _id: clienteId, 
        usuarioId,
        ativo: true 
      });

      if (!cliente) {
        return {
          sucesso: false,
          erros: ['Cliente não encontrado']
        };
      }

      return {
        sucesso: true,
        cliente: cliente.toJSON()
      };

    } catch (error) {
      console.error('❌ Erro ao buscar cliente:', error.message);
      throw new Error(`Erro ao buscar cliente: ${error.message}`);
    }
  }

  /**
   * Buscar cliente por documento
   */
  async buscarClientePorDocumento(documento, usuarioId) {
    try {
      const documentoLimpo = documento.replace(/\D/g, '');
      
      const cliente = await Cliente.findOne({ 
        documento: documentoLimpo, 
        usuarioId,
        ativo: true 
      });

      if (!cliente) {
        return {
          sucesso: false,
          erros: ['Cliente não encontrado']
        };
      }

      return {
        sucesso: true,
        cliente: cliente.toJSON()
      };

    } catch (error) {
      console.error('❌ Erro ao buscar cliente por documento:', error.message);
      throw new Error(`Erro ao buscar cliente: ${error.message}`);
    }
  }

  /**
   * Listar clientes com filtros e paginação
   */
  async listarClientes(filtros = {}, usuarioId) {
    try {
      const {
        pagina = 1,
        limite = 20,
        busca = '',
        tipo = '',
        ativo = true,
        ordenacao = 'nome'
      } = filtros;

      // Constrói query
      const query = { usuarioId };
      
      if (ativo !== undefined) {
        query.ativo = ativo;
      }

      if (tipo) {
        query.tipo = tipo;
      }

      if (busca) {
        query.$or = [
          { nome: { $regex: busca, $options: 'i' } },
          { razaoSocial: { $regex: busca, $options: 'i' } },
          { documento: { $regex: busca.replace(/\D/g, ''), $options: 'i' } },
          { email: { $regex: busca, $options: 'i' } }
        ];
      }

      // Executa consulta com paginação
      const skip = (pagina - 1) * limite;
      const [clientes, total] = await Promise.all([
        Cliente.find(query)
          .sort({ [ordenacao]: 1 })
          .skip(skip)
          .limit(limite)
          .lean(),
        Cliente.countDocuments(query)
      ]);

      return {
        sucesso: true,
        clientes,
        paginacao: {
          pagina: parseInt(pagina),
          limite: parseInt(limite),
          total,
          totalPaginas: Math.ceil(total / limite)
        }
      };

    } catch (error) {
      console.error('❌ Erro ao listar clientes:', error.message);
      throw new Error(`Erro ao listar clientes: ${error.message}`);
    }
  }

  /**
   * Desativar cliente (soft delete)
   */
  async desativarCliente(clienteId, usuarioId) {
    try {
      const cliente = await Cliente.findOneAndUpdate(
        { _id: clienteId, usuarioId },
        { $set: { ativo: false } },
        { new: true }
      );

      if (!cliente) {
        return {
          sucesso: false,
          erros: ['Cliente não encontrado']
        };
      }

      console.log('✅ Cliente desativado:', clienteId);
      
      return {
        sucesso: true,
        cliente: cliente.toJSON()
      };

    } catch (error) {
      console.error('❌ Erro ao desativar cliente:', error.message);
      throw new Error(`Erro ao desativar cliente: ${error.message}`);
    }
  }

  // ==================== VALIDAÇÕES E CONSULTAS EXTERNAS ====================

  /**
   * Validar documento (CPF/CNPJ)
   */
  async validarDocumento(documento, tipo) {
    try {
      if (tipo === 'cpf') {
        return {
          valido: this.validationService.validarFormatoCPF(documento),
          tipo: 'cpf'
        };
      } else if (tipo === 'cnpj') {
        return {
          valido: this.validationService.validarFormatoCNPJ(documento),
          tipo: 'cnpj'
        };
      }
      
      return { valido: false, erro: 'Tipo de documento inválido' };

    } catch (error) {
      console.error('❌ Erro ao validar documento:', error.message);
      return { valido: false, erro: error.message };
    }
  }

  /**
   * Consultar CNPJ na Receita Federal
   */
  async consultarCNPJ(cnpj) {
    try {
      const dados = await this.validationService.consultarCNPJ(cnpj);
      return {
        sucesso: true,
        dados
      };
    } catch (error) {
      console.error('❌ Erro ao consultar CNPJ:', error.message);
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  /**
   * Consultar CEP
   */
  async consultarCEP(cep) {
    try {
      const dados = await this.validationService.consultarCEP(cep);
      return {
        sucesso: true,
        dados
      };
    } catch (error) {
      console.error('❌ Erro ao consultar CEP:', error.message);
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  /**
   * Obter estados brasileiros
   */
  async obterEstados() {
    try {
      const estados = await this.validationService.obterEstados();
      return {
        sucesso: true,
        estados
      };
    } catch (error) {
      console.error('❌ Erro ao obter estados:', error.message);
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  /**
   * Obter cidades por UF
   */
  async obterCidades(uf) {
    try {
      const cidades = await this.validationService.obterCidades(uf);
      return {
        sucesso: true,
        cidades
      };
    } catch (error) {
      console.error('❌ Erro ao obter cidades:', error.message);
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }

  // ==================== RELATÓRIOS E ESTATÍSTICAS ====================

  /**
   * Obter estatísticas de clientes
   */
  async obterEstatisticas(usuarioId) {
    try {
      const [
        totalAtivos,
        totalInativos,
        totalPorTipo,
        clientesRecentes
      ] = await Promise.all([
        Cliente.countDocuments({ usuarioId, ativo: true }),
        Cliente.countDocuments({ usuarioId, ativo: false }),
        Cliente.aggregate([
          { $match: { usuarioId, ativo: true } },
          { $group: { _id: '$tipo', total: { $sum: 1 } } }
        ]),
        Cliente.find({ usuarioId, ativo: true })
          .sort({ dataCadastro: -1 })
          .limit(5)
          .select('nome documento tipo dataCadastro')
          .lean()
      ]);

      const estatisticas = {
        total: totalAtivos + totalInativos,
        ativos: totalAtivos,
        inativos: totalInativos,
        porTipo: totalPorTipo.reduce((acc, item) => {
          acc[item._id] = item.total;
          return acc;
        }, {}),
        recentes: clientesRecentes
      };

      return {
        sucesso: true,
        estatisticas
      };

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error.message);
      throw new Error(`Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Exportar clientes para CSV
   */
  async exportarClientes(filtros = {}, usuarioId) {
    try {
      const resultado = await this.listarClientes({
        ...filtros,
        limite: 10000 // Exporta todos
      }, usuarioId);

      if (!resultado.sucesso) {
        return resultado;
      }

      const csv = this.gerarCSV(resultado.clientes);
      
      return {
        sucesso: true,
        csv,
        total: resultado.clientes.length
      };

    } catch (error) {
      console.error('❌ Erro ao exportar clientes:', error.message);
      throw new Error(`Erro ao exportar clientes: ${error.message}`);
    }
  }

  /**
   * Gerar CSV dos clientes
   */
  gerarCSV(clientes) {
    const headers = [
      'Tipo',
      'Documento',
      'Nome',
      'Razão Social',
      'Email',
      'Telefone',
      'CEP',
      'Logradouro',
      'Número',
      'Bairro',
      'Cidade',
      'UF',
      'Data Cadastro',
      'Ativo'
    ];

    const linhas = clientes.map(cliente => [
      cliente.tipo?.toUpperCase() || '',
      cliente.documento || '',
      cliente.nome || '',
      cliente.razaoSocial || '',
      cliente.email || '',
      cliente.telefone || '',
      cliente.endereco?.cep || '',
      cliente.endereco?.logradouro || '',
      cliente.endereco?.numero || '',
      cliente.endereco?.bairro || '',
      cliente.endereco?.cidade || '',
      cliente.endereco?.uf || '',
      new Date(cliente.dataCadastro).toLocaleDateString('pt-BR'),
      cliente.ativo ? 'Sim' : 'Não'
    ]);

    return [headers, ...linhas]
      .map(linha => linha.map(campo => `"${campo}"`).join(','))
      .join('\n');
  }

  // ==================== LIMPEZA E MANUTENÇÃO ====================

  /**
   * Limpar cache de validações
   */
  limparCache() {
    this.validationService.limparCache();
    console.log('✅ Cache de validações limpo');
  }

  /**
   * Obter estatísticas do cache
   */
  obterEstatisticasCache() {
    return this.validationService.estatisticasCache();
  }
}

module.exports = new ClienteService();