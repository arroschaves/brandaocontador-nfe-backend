#!/usr/bin/env node

/**
 * Script para criar usuário administrador inicial
 * Email: cjbrandao@brandaocontador.com.br
 * Senha: @Pa2684653#
 * 
 * Uso: node scripts/create-admin.js
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function createAdmin() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║    CRIAÇÃO DE USUÁRIO ADMINISTRADOR - Sistema NFe Brandão     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const adminData = {
    id: 'admin-' + Date.now(),
    email: 'cjbrandao@brandaocontador.com.br',
    senha: '@Pa2684653#',
    nome: 'Carlos José Brandão',
    tipo: 'admin',
    tipoCliente: 'admin',
    permissoes: [
      'nfe_emitir',
      'nfe_consultar',
      'nfe_cancelar',
      'nfe_inutilizar',
      'cte_emitir',
      'cte_consultar',
      'mdfe_emitir',
      'mdfe_consultar',
      'clientes_criar',
      'clientes_editar',
      'clientes_excluir',
      'produtos_criar',
      'produtos_editar',
      'produtos_excluir',
      'configuracoes_editar',
      'usuarios_gerenciar',
      'relatorios_visualizar',
      'admin_total'
    ],
    ativo: true,
    dataCriacao: new Date().toISOString(),
    dataUltimoAcesso: new Date().toISOString(),
    configuracoes: {
      empresa: null, // Será preenchido pelo usuário
      nfe: null,
      certificado: null
    }
  };

  try {
    // Hash da senha
    console.log('🔐 Gerando hash da senha...');
    const senhaHash = await bcrypt.hash(adminData.senha, 10);
    
    // Substituir senha pelo hash
    const adminDataFinal = {
      ...adminData,
      senha: senhaHash
    };

    // Garantir que diretório data/ existe
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 Diretório data/ criado');
    }

    // Verificar se arquivo users.json existe
    const usersPath = path.join(dataDir, 'users.json');
    let users = [];
    
    if (fs.existsSync(usersPath)) {
      const usersContent = fs.readFileSync(usersPath, 'utf8');
      try {
        users = JSON.parse(usersContent);
        console.log(`📋 Arquivo users.json encontrado com ${users.length} usuário(s)`);
      } catch (error) {
        console.log('⚠️  Arquivo users.json corrompido, criando novo');
        users = [];
      }
    } else {
      console.log('📋 Criando novo arquivo users.json');
    }

    // Verificar se admin já existe
    const adminExists = users.find(u => u.email === adminData.email);
    if (adminExists) {
      console.log('⚠️  Usuário administrador já existe!');
      console.log(`   ID: ${adminExists.id}`);
      console.log(`   Email: ${adminExists.email}`);
      console.log(`   Tipo: ${adminExists.tipo}`);
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      return new Promise((resolve) => {
        readline.question('\n❓ Deseja SUBSTITUIR o usuário existente? (sim/não): ', (answer) => {
          readline.close();
          if (answer.toLowerCase() === 'sim' || answer.toLowerCase() === 's') {
            // Remover usuário antigo
            users = users.filter(u => u.email !== adminData.email);
            
            // Adicionar novo
            users.push(adminDataFinal);
            
            // Salvar
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
            
            console.log('\n✅ Usuário administrador SUBSTITUÍDO com sucesso!');
            printAdminInfo(adminDataFinal);
            resolve();
          } else {
            console.log('\n❌ Operação cancelada');
            resolve();
          }
        });
      });
    } else {
      // Adicionar admin
      users.push(adminDataFinal);
      
      // Salvar arquivo
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
      
      console.log('\n✅ Usuário administrador criado com sucesso!');
      printAdminInfo(adminDataFinal);
    }

  } catch (error) {
    console.error('\n❌ Erro ao criar usuário administrador:', error.message);
    process.exit(1);
  }
}

function printAdminInfo(admin) {
  console.log('\n' + '─'.repeat(66));
  console.log('\n📋 Informações do Administrador:\n');
  console.log(`   ID:          ${admin.id}`);
  console.log(`   Email:       ${admin.email}`);
  console.log(`   Nome:        ${admin.nome}`);
  console.log(`   Tipo:        ${admin.tipo}`);
  console.log(`   Permissões:  ${admin.permissoes.length} permissões`);
  console.log(`   Status:      ${admin.ativo ? 'Ativo ✅' : 'Inativo ❌'}`);
  console.log('\n' + '─'.repeat(66));
  console.log('\n⚠️  IMPORTANTE:');
  console.log('  • Use este email e senha para fazer login');
  console.log('  • Configure os dados da empresa em Configurações');
  console.log('  • Faça upload do certificado digital');
  console.log('  • Este é o ÚNICO usuário com acesso total ao sistema\n');
}

// Executar
createAdmin().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
