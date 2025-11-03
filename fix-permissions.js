const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando correção de permissões...\n');

// Caminhos dos arquivos
const usuariosPath = path.join(__dirname, 'data', 'usuarios.json');
const authServicePath = path.join(__dirname, 'services', 'auth-service.js');

// Permissões completas para administrador
const adminPermissions = [
  'all',
  'admin',
  'admin_total',
  'nfe_emitir',
  'nfe_consultar',
  'nfe_inutilizar',
  'nfe_cancelar',
  'cte_emitir',
  'cte_consultar',
  'mdfe_emitir',
  'mdfe_consultar',
  'eventos_gerenciar',
  'relatorios_visualizar',
  'relatorios_acessar',
  'admin_configurar',
  'admin_auditoria',
  'admin_interface',
  'configuracoes_ver',
  'configuracoes_gerenciar',
  'configuracoes_avancadas',
  'seguranca_auditoria',
  'interface_temas',
  'usuarios_gerenciar',
  'clientes_gerenciar',
  'produtos_gerenciar',
  'dashboard_acessar',
  'emitente_configurar',
  'sistema_administrar'
];

// Permissões para clientes
const clientPermissions = [
  'nfe_emitir',
  'nfe_consultar',
  'nfe_inutilizar',
  'cte_emitir',
  'cte_consultar',
  'mdfe_emitir',
  'mdfe_consultar',
  'relatorios_visualizar',
  'configuracoes_ver'
];

function corrigirUsuarios() {
  try {
    console.log('📁 Corrigindo permissões dos usuários...');
    
    if (!fs.existsSync(usuariosPath)) {
      console.log('❌ Arquivo usuarios.json não encontrado!');
      return false;
    }

    const usuarios = JSON.parse(fs.readFileSync(usuariosPath, 'utf8'));
    let alteracoes = false;

    usuarios.forEach(usuario => {
      if (usuario.isAdmin || usuario.perfil === 'admin' || usuario.tipo === 'admin') {
        console.log(`🔑 Atualizando permissões do administrador: ${usuario.nome}`);
        usuario.permissoes = [...new Set([...adminPermissions])]; // Remove duplicatas
        alteracoes = true;
      } else {
        console.log(`👤 Atualizando permissões do cliente: ${usuario.nome}`);
        usuario.permissoes = [...new Set([...clientPermissions])]; // Remove duplicatas
        alteracoes = true;
      }
    });

    if (alteracoes) {
      fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));
      console.log('✅ Permissões dos usuários atualizadas com sucesso!');
    } else {
      console.log('ℹ️  Nenhuma alteração necessária nos usuários.');
    }

    return true;
  } catch (error) {
    console.error('❌ Erro ao corrigir usuários:', error.message);
    return false;
  }
}

function corrigirAuthService() {
  try {
    console.log('\n📁 Corrigindo auth-service.js...');
    
    if (!fs.existsSync(authServicePath)) {
      console.log('❌ Arquivo auth-service.js não encontrado!');
      return false;
    }

    let conteudo = fs.readFileSync(authServicePath, 'utf8');
    
    // Permissões padrão formatadas para o código
    const permissoesFormatadas = clientPermissions.map(p => `          '${p}'`).join(',\n');
    
    // Padrão para encontrar e substituir as permissões padrão no registro
    const padraoRegistro = /permissoes:\s*dadosUsuario\.permissoes\s*\|\|\s*\[[\s\S]*?\]/;
    const novaPermissaoRegistro = `permissoes: dadosUsuario.permissoes || [
${permissoesFormatadas}
        ]`;

    // Padrão para encontrar e substituir as permissões padrão no login social
    const padraoSocial = /permissoes:\s*\[[\s\S]*?\]/;
    const novaPermissaoSocial = `permissoes: [
${permissoesFormatadas}
          ]`;

    let alteracoes = false;

    if (padraoRegistro.test(conteudo)) {
      conteudo = conteudo.replace(padraoRegistro, novaPermissaoRegistro);
      console.log('✅ Permissões padrão do registro atualizadas');
      alteracoes = true;
    }

    // Para o login social, precisamos ser mais específicos
    const linhasSocial = conteudo.split('\n');
    let dentroSocialLogin = false;
    let indiceSocialPermissoes = -1;

    for (let i = 0; i < linhasSocial.length; i++) {
      if (linhasSocial[i].includes('async socialLogin')) {
        dentroSocialLogin = true;
      }
      
      if (dentroSocialLogin && linhasSocial[i].trim().startsWith('permissoes: [')) {
        indiceSocialPermissoes = i;
        break;
      }
    }

    if (indiceSocialPermissoes !== -1) {
      // Encontrar o final do array de permissões
      let fimArray = indiceSocialPermissoes;
      for (let i = indiceSocialPermissoes; i < linhasSocial.length; i++) {
        if (linhasSocial[i].includes(']')) {
          fimArray = i;
          break;
        }
      }

      // Substituir as linhas das permissões
      const novasLinhas = [
        '          permissoes: [',
        ...clientPermissions.map(p => `            '${p}',`),
        '          ],'
      ];

      linhasSocial.splice(indiceSocialPermissoes, fimArray - indiceSocialPermissoes + 1, ...novasLinhas);
      conteudo = linhasSocial.join('\n');
      console.log('✅ Permissões padrão do login social atualizadas');
      alteracoes = true;
    }

    if (alteracoes) {
      fs.writeFileSync(authServicePath, conteudo);
      console.log('✅ auth-service.js atualizado com sucesso!');
    } else {
      console.log('ℹ️  Nenhuma alteração necessária no auth-service.js');
    }

    return true;
  } catch (error) {
    console.error('❌ Erro ao corrigir auth-service.js:', error.message);
    return false;
  }
}

function verificarMiddleware() {
  try {
    console.log('\n📁 Verificando middleware de autenticação...');
    
    const middlewarePath = path.join(__dirname, 'middleware', 'auth.js');
    
    if (!fs.existsSync(middlewarePath)) {
      console.log('❌ Arquivo middleware/auth.js não encontrado!');
      return false;
    }

    const conteudo = fs.readFileSync(middlewarePath, 'utf8');
    
    // Verificar se há verificação adequada para admin
    if (conteudo.includes('admin') || conteudo.includes('all')) {
      console.log('✅ Middleware parece estar configurado para admins');
    } else {
      console.log('⚠️  Middleware pode precisar de ajustes para admins');
    }

    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar middleware:', error.message);
    return false;
  }
}

// Executar correções
async function executarCorrecoes() {
  console.log('🚀 Iniciando correção completa de permissões...\n');
  
  const resultados = {
    usuarios: corrigirUsuarios(),
    authService: corrigirAuthService(),
    middleware: verificarMiddleware()
  };

  console.log('\n📊 Resumo das correções:');
  console.log(`   Usuários: ${resultados.usuarios ? '✅' : '❌'}`);
  console.log(`   Auth Service: ${resultados.authService ? '✅' : '❌'}`);
  console.log(`   Middleware: ${resultados.middleware ? '✅' : '❌'}`);

  if (Object.values(resultados).every(r => r)) {
    console.log('\n🎉 Todas as correções foram aplicadas com sucesso!');
    console.log('\n📋 Permissões aplicadas:');
    console.log('\n👑 ADMINISTRADOR:');
    adminPermissions.forEach(p => console.log(`   - ${p}`));
    console.log('\n👤 CLIENTES:');
    clientPermissions.forEach(p => console.log(`   - ${p}`));
    console.log('\n💡 Reinicie o servidor para aplicar as mudanças.');
  } else {
    console.log('\n⚠️  Algumas correções falharam. Verifique os erros acima.');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  executarCorrecoes();
}

module.exports = { executarCorrecoes, adminPermissions, clientPermissions };