/* Smoke test for real backend (app-real.js) */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_SENHA = process.env.SMOKE_ADMIN_SENHA || process.env.SEED_ADMIN_SENHA || process.env.ADMIN_SENHA || 'adminpassword';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let bodyText = await res.text();
  let body;
  try { body = JSON.parse(bodyText); } catch { body = bodyText; }
  return { status: res.status, body };
}

(async () => {
  let failures = 0;
  console.log(`\n🚦 Smoke test base: ${BASE_URL}`);
  console.log(`👤 Usando admin: ${ADMIN_EMAIL}`);

  // Health
  const health = await req('/health');
  console.log('Health:', health.status, health.body);
  if (health.status !== 200) failures++;

  // Login admin (seeded)
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, senha: ADMIN_SENHA })
  });
  console.log('Login admin:', login.status, login.body);
  if (login.status !== 200 || !login.body?.token) failures++;
  const token = login.body?.token;

  // List admin users
  const users = await req('/admin/usuarios', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Admin usuarios:', users.status, users.body);
  if (users.status !== 200) failures++;

  // NFe status (auth)
  const statusNfe = await req('/nfe/status', { headers: { Authorization: `Bearer ${token}` } });
  console.log('NFe status:', statusNfe.status, statusNfe.body);
  if (statusNfe.status !== 200) failures++;

  // Admin health (auth required)
  const adminHealth = await req('/admin/health', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Admin health:', adminHealth.status, adminHealth.body);
  if (adminHealth.status !== 200) failures++;

  if (failures > 0) {
    console.error(`\n❌ Smoke test falhou com ${failures} problemas.`);
    process.exit(1);
  } else {
    console.log('\n✅ Smoke test passou. Backend OK.');
  }
})();