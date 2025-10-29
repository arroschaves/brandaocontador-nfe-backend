const database = require('../config/database');
const ValidationExternalService = require('./validation-external-service');
const { v4: uuidv4 } = require('uuid');

/**
 * Serviço de Clientes
 * 
 * Gerencia operações CRUD de clientes com validação automática de:
 * - CNPJ/CPF via Receita Federal
 * - CEP via BrasilAPI/ViaCEP
 * - Enriquecimento automático de dados
 * - Estados e cidades brasileiras
 * 
 * Sistema usando apenas arquivos JSON - sem MongoDB
 */
class ClienteService {
  constructor() {
    this.validationService = new ValidationExternalService();
    this.db = database;
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

      // Verifica se cliente já existe
      const clientes = await this.db.listarClientes();
      const documentoLimpo = validacao.dados.documento.replace(/\D/g, '');
      
      const clienteExistente = clientes.find(c => 
        c.documento === documentoLimpo && 
        c.usuarioId === usuarioId && 
        c.ativo
      );

      if (clienteExistente) {
        return {
          sucesso: false,
          erros: ['Cliente com este documento já existe']
        };
      }

      // Cria novo cliente
      const novoCliente = {
        id: uuidv4(),
        ...validacao.dados,
        documento: documentoLimpo,
        usuarioId,
        ativo: true,
        dataCadastro: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString()
      };

      const clienteCriado = await this.db.criarCliente(novoCliente);

      console.log('✅ Cliente criado com sucesso:', clienteCriado.id);
      
      return {
        sucesso: true,
        cliente: clienteCriado,
        avisos: validacao.avisos
      };

    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error.message);
      throw new Error(`Erro ao criar cliente: ${error.message}`);
    }
  }

  /**
   * Atualizar cliente existente
   */
  async atualizarCliente(clienteId, dadosAtualizacao, usuarioId) {
    try {
      console.log('👤 Atualizando cliente:', clienteId);

      const cliente = await this.db.buscarClientePorId(clienteId);
      
      if (!cliente || cliente.usuarioId !== usuarioId || !cliente.ativo) {
        return {
          sucesso: false,
          erros: ['Cliente não encontrado']
        };
      }

      // Valida dados se houver mudanças significativas
      if (dadosAtualizacao.documento || dadosAtualizacao.email) {
        const validacao = await this.validationService.validarEEnriquecerCliente({
          ...cliente,
          ...dadosAtualizacao
        });
        
        if (!validacao.valido) {
          return {
            sucesso: false,
            erros: validacao.erros,
            avisos: validacao.avisos
          };
        }
      }

      const dadosAtualizados = {
        ...dadosAtualizacao,
        dataAtualizacao: new Date().toISOString()
      };

      const clienteAtualizado = await this.db.atualizarCliente(clienteId, dadosAtualizados);

      return {
        sucesso: true,
        cliente: clienteAtualizado
      };

    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error.message);
      throw new Error(`Erro ao atualizar cliente: ${error.message}`);
    }
  }

  /**
   * Buscar cliente por ID
   */
  async buscarClientePorId(clienteId, usuarioId) {
    try {
      const cliente = await this.db.buscarClientePorId(clienteId);
      
      if (!cliente || cliente.usuarioId !== usuarioId || !cliente.ativo) {
        return {
          sucesso: false,
          erros: ['Cliente não encontrado']
        };
      }

      return {
        sucesso: true,
        cliente
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
      const clientes = await this.db.listarClientes();
      
      const cliente = clientes.find(c => 
        c.documento === documentoLimpo && 
        c.usuarioId === usuarioId && 
        c.ativo
      );

      if (!cliente) {
        return {
          sucesso: false,
          erros: ['Cliente não encontrado']
        };
      }

      return {
        sucesso: true,
        cliente
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
      const clientes = await this.db.listarClientes();
      
      // Filtrar por usuário e status ativo
      let clientesFiltrados = clientes.filter(c => 
        c.usuarioId === usuarioId && c.ativo
      );

      // Aplicar filtros
      if (filtros.nome) {
        const nomeFilter = filtros.nome.toLowerCase();
        clientesFiltrados = clientesFiltrados.filter(c => 
          c.nome?.toLowerCase().includes(nomeFilter) ||
          c.razaoSocial?.toLowerCase().includes(nomeFilter)
        );
      }

      if (filtros.documento) {
        const docFilter = filtros.documento.replace(/\D/g, '');
        clientesFiltrados = clientesFiltrados.filter(c => 
          c.documento?.includes(docFilter)
        );
      }

      if (filtros.tipoCliente) {
        clientesFiltrados = clientesFiltrados.filter(c => 
          c.tipoCliente === filtros.tipoCliente
        );
      }

      if (filtros.cidade) {
        const cidadeFilter = filtros.cidade.toLowerCase();
        clientesFiltrados = clientesFiltrados.filter(c => 
          c.endereco?.cidade?.toLowerCase().includes(cidadeFilter)
        );
      }

      if (filtros.uf) {
        clientesFiltrados = clientesFiltrados.filter(c => 
          c.endereco?.uf === filtros.uf.toUpperCase()
        );
      }

      // Ordenação
      const ordenacao = filtros.ordenacao || 'nome';
      const direcao = filtros.direcao || 'asc';
      
      clientesFiltrados.sort((a, b) => {
        let valorA = a[ordenacao] || '';
        let valorB = b[ordenacao] || '';
        
        if (typeof valorA === 'string') {
          valorA = valorA.toLowerCase();
          valorB = valorB.toLowerCase();
        }
        
        if (direcao === 'desc') {
          return valorB > valorA ? 1 : -1;
        }
        return valorA > valorB ? 1 : -1;
      });

      // Paginação
      const pagina = parseInt(filtros.pagina) || 1;
      const limite = parseInt(filtros.limite) || 20;
      const inicio = (pagina - 1) * limite;
      const fim = inicio + limite;

      const clientesPaginados = clientesFiltrados.slice(inicio, fim);
      const total = clientesFiltrados.length;
      const totalPaginas = Math.ceil(total / limite);

      return {
        sucesso: true,
        clientes: clientesPaginados,
        paginacao: {
          pagina,
          limite,
          total,
          totalPaginas,
          temProxima: pagina < totalPaginas,
          temAnterior: pagina > 1
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
      const cliente = await this.db.buscarClientePorId(clienteId);
      
      if (!cliente || cliente.usuarioId !== usuarioId) {
        return {
          sucesso: false,
          erros: ['Cliente não encontrado']
        };
      }

      await this.db.atualizarCliente(clienteId, {
        ativo: false,
        dataDesativacao: new Date().toISOString()
      });

      return {
        sucesso: true,
        mensagem: 'Cliente desativado com sucesso'
      };

    } catch (error) {
      console.error('❌ Erro ao desativar cliente:', error.message);
      throw new Error(`Erro ao desativar cliente: ${error.message}`);
    }
  }

  /**
   * Obter estatísticas de clientes
   */
  async obterEstatisticas(usuarioId) {
    try {
      const clientes = await this.db.listarClientes();
      const clientesUsuario = clientes.filter(c => c.usuarioId === usuarioId && c.ativo);

      const estatisticas = {
        total: clientesUsuario.length,
        porTipo: {
          cpf: clientesUsuario.filter(c => c.tipoCliente === 'cpf').length,
          cnpj: clientesUsuario.filter(c => c.tipoCliente === 'cnpj').length
        },
        porEstado: {},
        recentes: clientesUsuario
          .sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro))
          .slice(0, 5)
      };

      // Agrupar por estado
      clientesUsuario.forEach(cliente => {
        const uf = cliente.endereco?.uf || 'Não informado';
        estatisticas.porEstado[uf] = (estatisticas.porEstado[uf] || 0) + 1;
      });

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
  async exportarCSV(filtros = {}, usuarioId) {
    try {
      const resultado = await this.listarClientes(filtros, usuarioId);
      
      if (!resultado.sucesso) {
        return resultado;
      }

      const clientes = resultado.clientes;
      
      // Cabeçalho CSV
      const cabecalho = [
        'ID', 'Nome/Razão Social', 'Documento', 'Tipo', 'Email', 'Telefone',
        'CEP', 'Logradouro', 'Número', 'Bairro', 'Cidade', 'UF',
        'Data Cadastro'
      ].join(',');

      // Linhas de dados
      const linhas = clientes.map(cliente => [
        cliente.id,
        `"${cliente.nome || cliente.razaoSocial || ''}"`,
        cliente.documento || '',
        cliente.tipoCliente || '',
        cliente.email || '',
        cliente.telefone || '',
        cliente.endereco?.cep || '',
        `"${cliente.endereco?.logradouro || ''}"`,
        cliente.endereco?.numero || '',
        `"${cliente.endereco?.bairro || ''}"`,
        `"${cliente.endereco?.cidade || ''}"`,
        cliente.endereco?.uf || '',
        cliente.dataCadastro || ''
      ].join(','));

      const csv = [cabecalho, ...linhas].join('\n');

      return {
        sucesso: true,
        csv,
        nomeArquivo: `clientes_${new Date().toISOString().split('T')[0]}.csv`
      };

    } catch (error) {
      console.error('❌ Erro ao exportar CSV:', error.message);
      throw new Error(`Erro ao exportar CSV: ${error.message}`);
    }
  }
}

module.exports = new ClienteService();