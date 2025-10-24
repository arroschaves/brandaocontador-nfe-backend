const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { DatabaseService } = require('../services/database-service');

// Obter configuração do emitente
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const db = new DatabaseService();
    const config = await db.getConfiguration('emitente');
    
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
router.post('/config', authenticateToken, async (req, res) => {
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
    
    if (!endereco.logradouro || !endereco.numero || !endereco.bairro || 
        !endereco.municipio || !endereco.uf || !endereco.cep) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Endereço incompleto: logradouro, numero, bairro, municipio, uf e cep são obrigatórios'
      });
    }
    
    // Validar CNPJ (formato básico)
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      return res.status(400).json({
        sucesso: false,
        erro: 'CNPJ deve ter 14 dígitos'
      });
    }
    
    // Preparar dados para salvar
    const dadosEmitente = {
      nome,
      cnpj: cnpjLimpo,
      inscricaoEstadual,
      inscricaoMunicipal: emitente.inscricaoMunicipal || '',
      regimeTributario: parseInt(regimeTributario),
      endereco: {
        cep: endereco.cep.replace(/\D/g, ''),
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        complemento: endereco.complemento || '',
        bairro: endereco.bairro,
        municipio: endereco.municipio,
        uf: endereco.uf.toUpperCase(),
        codigoMunicipio: endereco.codigoMunicipio || ''
      },
      dataAtualizacao: new Date().toISOString()
    };
    
    const db = new DatabaseService();
    await db.setConfiguration('emitente', dadosEmitente);
    
    res.json({
      sucesso: true,
      mensagem: 'Configuração do emitente salva com sucesso',
      emitente: dadosEmitente
    });
    
  } catch (error) {
    console.error('Erro ao salvar configuração do emitente:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor'
    });
  }
});

module.exports = router;