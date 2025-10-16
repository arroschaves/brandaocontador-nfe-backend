const request = require('supertest');
const app = require('../app-simples');

async function run() {
  try {
    console.log('🔎 Testando /health');
    const healthRes = await request(app).get('/health');
    console.log('Health:', healthRes.status, healthRes.body);

    console.log('🔐 Testando login de administrador');
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@brandaocontador.com.br', senha: 'admin123' })
      .set('Accept', 'application/json');
    console.log('Login:', loginRes.status, loginRes.body);

    if (loginRes.status !== 200 || !loginRes.body || !loginRes.body.token) {
      throw new Error('Falha no login do administrador ou token ausente');
    }
    const token = loginRes.body.token;

    console.log('👥 Testando listagem de usuários (rota admin)');
    const listRes = await request(app)
      .get('/admin/usuarios')
      .set('Authorization', `Bearer ${token}`);
    console.log('Listagem:', listRes.status);
    if (listRes.status !== 200) {
      console.error('Resposta:', listRes.body);
      throw new Error('Falha ao listar usuários');
    }

    const usuarios = listRes.body && listRes.body.usuarios ? listRes.body.usuarios : [];
    console.log('✅ Usuários obtidos:', usuarios.length);
    console.log(usuarios.map(u => ({ id: u.id, email: u.email, perfil: u.perfil, status: u.status })));

    console.log('🎉 Testes concluídos com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro nos testes:', error.message);
    process.exit(1);
  }
}

run();