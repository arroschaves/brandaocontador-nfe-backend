/**
 * Script de teste para verificar se as permissões CTe e MDFe 
 * estão sendo aplicadas corretamente aos novos usuários
 */

const AuthService = require('./services/auth-service');

async function testarPermissoesNovoUsuario() {
  console.log('🧪 Testando permissões de novo usuário...\n');

  try {
    // Dados de teste para um novo cliente
    const dadosCliente = {
      nome: 'Cliente Teste',
      email: 'cliente.teste@exemplo.com',
      senha: '123456',
      tipoCliente: 'cnpj',
      documento: '12345678000199',
      telefone: '(11) 99999-9999'
    };

    console.log('📝 Criando novo usuário cliente...');
    const resultado = await AuthService.register(dadosCliente);

    if (resultado.sucesso) {
      console.log('✅ Usuário criado com sucesso!');
      console.log('👤 Nome:', resultado.usuario.nome);
      console.log('📧 Email:', resultado.usuario.email);
      console.log('🔑 Permissões:', resultado.usuario.permissoes);
      
      // Verificar se as permissões CTe e MDFe estão presentes
      const permissoesEsperadas = [
        'nfe_emitir',
        'nfe_consultar', 
        'cte_emitir',
        'cte_consultar',
        'mdfe_emitir',
        'mdfe_consultar'
      ];

      console.log('\n🔍 Verificando permissões...');
      let todasPermissoesPresentes = true;

      permissoesEsperadas.forEach(permissao => {
        const presente = resultado.usuario.permissoes.includes(permissao);
        console.log(`${presente ? '✅' : '❌'} ${permissao}: ${presente ? 'PRESENTE' : 'AUSENTE'}`);
        if (!presente) todasPermissoesPresentes = false;
      });

      if (todasPermissoesPresentes) {
        console.log('\n🎉 SUCESSO! Todas as permissões necessárias estão presentes.');
        console.log('🎯 Os clientes agora poderão ver os menus CTe e MDFe no frontend.');
      } else {
        console.log('\n❌ ERRO! Algumas permissões estão faltando.');
      }

    } else {
      console.log('❌ Erro ao criar usuário:', resultado.erro);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar o teste
testarPermissoesNovoUsuario();