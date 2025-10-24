const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
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

// Endpoint de teste para debug do body parsing
router.post('/test-body', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    console.log('TEST - req.body:', JSON.stringify(req.body, null, 2));
    console.log('TEST - req.headers:', JSON.stringify(req.headers, null, 2));
    
    res.json({
      sucesso: true,
      body: req.body,
      headers: req.headers,
      contentType: req.get('Content-Type')
    });
  } catch (error) {
    console.error('Erro no teste:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro interno do servidor'
    });
  }
});

// Salvar configuração do emitente
router.post('/config', authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    console.log('DEBUG - req.body:', JSON.stringify(req.body, null, 2));
    const { emitente } = req.body;
    console.log('DEBUG - emitente:', JSON.stringify(emitente, null, 2));
    
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
    
    await DatabaseService.setConfiguration('emitente', dadosEmitente);
    
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