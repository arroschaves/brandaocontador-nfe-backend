const db = require('./backend/config/database-simples');

async function adicionarConfigEmitente() {
  try {
    console.log('📊 Carregando banco de dados...');
    
    // Dados de exemplo do emitente
    const dadosEmitente = {
      nome: 'EMPRESA TESTE LTDA',
      cnpj: '11222333000144',
      inscricaoEstadual: '987654321',
      endereco: {
        cep: '01310100',
        logradouro: 'Avenida Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        municipio: 'São Paulo',
        uf: 'SP'
      },
      regimeTributario: 'SimplesNacional',
      email: 'contato@empresateste.com.br',
      telefone: '11999887766'
    };
    
    console.log('💾 Salvando configuração do emitente...');
    await db.setConfiguration('emitente', dadosEmitente);
    
    console.log('✅ Configuração do emitente salva com sucesso!');
    console.log('📋 Dados salvos:', JSON.stringify(dadosEmitente, null, 2));
    
    // Verificar se foi salvo
    const configSalva = await db.getConfiguration('emitente');
    console.log('🔍 Verificação - dados salvos:', configSalva);
    
  } catch (error) {
    console.error('❌ Erro ao salvar configuração:', error);
  }
}

adicionarConfigEmitente();