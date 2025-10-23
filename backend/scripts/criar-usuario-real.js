require('dotenv').config({ path: '.env.producao' });

const mongoose = require('mongoose');
const database = require('../config/database');
const Usuario = require('../models/Usuario');

async function limparECriarUsuarioReal() {
  try {
    console.log('🧹 Limpando banco de dados...');
    await database.connect();
    
    // Limpar TODOS os usuários existentes
    await Usuario.deleteMany({});
    console.log('✅ Todos os usuários de teste removidos');
    
    // Criar APENAS o usuário real
    const usuarioReal = new Usuario({
      nome: 'Brandão Contador',
      email: 'admin@brandaocontador.com.br',
      senha: 'BrandaoNFe2024!',
      tipoCliente: 'cnpj',
      documento: '45669746000120',
      telefone: '(11) 99999-9999',
      razaoSocial: 'Brandão Contador LTDA',
      nomeFantasia: 'Brandão Contador',
      endereco: {
        cep: '01001-000',
        logradouro: 'Rua Principal',
        numero: '100',
        complemento: 'Sala 1',
        bairro: 'Centro',
        cidade: 'São Paulo',
        uf: 'SP'
      },
      permissoes: ['admin_total', 'admin', 'nfe_emitir', 'nfe_consultar', 'nfe_cancelar', 'nfe_inutilizar'],
      ativo: true,
      status: 'ativo'
    });

    await usuarioReal.save();
    console.log('✅ Usuário real criado com sucesso!');
    console.log('📧 Email: admin@brandaocontador.com.br');
    console.log('🔑 Senha: BrandaoNFe2024!');
    console.log('🏢 Empresa: Brandão Contador LTDA');
    console.log('📄 CNPJ: 45669746000120');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exitCode = 1;
  } finally {
    try {
      await database.disconnect();
      console.log('🔌 Desconectado do banco');
    } catch (e) {}
  }
}

if (require.main === module) {
  limparECriarUsuarioReal();
}

module.exports = { limparECriarUsuarioReal };