const express = require('express');
const router = express.Router();
const database = require('../config/database');

// Rota do dashboard
router.get('/', async (req, res) => {
  try {
    // Dashboard básico - middleware já verificou autenticação
    res.json({
      sucesso: true,
      dados: {
        totalNfes: 0,
        totalClientes: 0,
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
    console.error('[DASHBOARD] Erro:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao carregar dados do dashboard'
    });
  }
});

module.exports = router;
