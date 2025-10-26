const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-real');
const DatabaseService = require('../config/database-simples');

// Obter configuração do emitente
router.get('/config', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const config = await DatabaseService.getConfiguration('emitente');
    
    if (!config) {
      return res.json({
        sucesso: true,
        emitente: null,
        configurado: false
      });
    }
    
    res.json({
      sucesso: true,
      emitente: config,
      configurado: true
    });
  } catch (error) {
    console.error('Erro ao obter configuração do emitente:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor'
    });
  }
});

// Salvar configuração do emitente
router.post('/config', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const { emitente } = req.body;
    
    // Validações básicas
    if (!emitente) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados do emitente são obrigatórios'
      });
    }
    
    const { nome, cnpj, inscricaoEstadual, endereco, regimeTributario } = emitente;
    
    if (!nome || !cnpj || !inscricaoEstadual || !endereco || !regimeTributario) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Campos obrigatórios: nome, cnpj, inscricaoEstadual, endereco, regimeTributario'
      });
    }
    
    // Salvar configuração
    await DatabaseService.saveConfiguration('emitente', emitente);
    
    res.json({
      sucesso: true,
      emitente,
      configurado: true
    });
  } catch (error) {
    console.error('Erro ao salvar configuração do emitente:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor'
    });
  }
});

// Atualizar configuração do emitente
router.put('/config', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const { emitente } = req.body;
    
    if (!emitente) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados do emitente são obrigatórios'
      });
    }
    
    // Atualizar configuração
    await DatabaseService.saveConfiguration('emitente', emitente);
    
    res.json({
      sucesso: true,
      emitente,
      configurado: true
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração do emitente:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor'
    });
  }
});

module.exports = router;