const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Rota do dashboard
router.get('/', async (req, res) => {
  try {
    // Buscar dados reais do banco
    const clientes = await database.listarClientes();
    
    // Para NFes, usar apenas sistema JSON
    let nfes = [];
    // Usar o método da configuração JSON
    nfes = await database.config.lerArquivo('nfes');
    
    // Filtrar apenas clientes ativos do usuário atual
    const clientesAtivos = clientes.filter(c => c.ativo && String(c.usuarioId) === String(req.usuario.id));
    
    // Filtrar NFes do usuário atual
    const nfesUsuario = nfes.filter(n => String(n.usuarioId) === String(req.usuario.id));

    res.json({
      sucesso: true,
      dados: {
        totalNfes: nfesUsuario.length,
        totalClientes: clientesAtivos.length,
        sistema: {
          status: 'online',
          versao: '1.0.0',
          ambiente: process.env.NODE_ENV || 'development'
        },
        sefaz: {
          disponivel: true,
          status: 'online',
          ambiente: process.env.NFE_AMBIENTE || 'homologacao'
        }
      }
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao carregar dados do dashboard'
    });
  }
});

module.exports = router;
