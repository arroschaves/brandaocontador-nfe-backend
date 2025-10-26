/**
 * Script de Deploy para Digital Ocean
 * Preparação e deploy automatizado do backend
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');
const moment = require('moment');

class DeployService {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.deployConfig = {
      ambiente: process.env.NODE_ENV || 'production',
      versao: this.obterVersao(),
      timestamp: moment().format('YYYYMMDD_HHmmss')
    };

    // Arquivos e pastas a serem incluídos no deploy
    this.incluirDeploy = [
      'app.js',
      'package.json',
      'package-lock.json',
      'config/',
      'controllers/',
      'middleware/',
      'models/',
      'routes/',
      'services/',
      'monitoring/',
      'utils/',
      'scripts/start.js',
      'scripts/health-check.js'
    ];

    // Arquivos e pastas a serem excluídos
    this.excluirDeploy = [
      'node_modules/',
      'logs/',
      'backups/',
      'uploads/',
      'certificados/',
      'temp/',
      '.env.local',
      '.env.development',
      'test/',
      'docs/',
      '*.log',
      '.git/',
      '.gitignore',
      'README.md'
    ];

    // Variáveis de ambiente para produção
    this.envProducao = {
      NODE_ENV: 'production',
      PORT: '3001',
      // Database
      DB_TYPE: 'mongodb',
      MONGODB_URI: '${MONGODB_URI}',
      // Security
      JWT_SECRET: '${JWT_SECRET}',
      ENCRYPTION_KEY: '${ENCRYPTION_KEY}',
      // SEFAZ
      SEFAZ_AMBIENTE: 'producao',
      SEFAZ_TIMEOUT: '30000',
      // Logs
      LOG_LEVEL: 'info',
      LOG_TO_FILE: 'true',
      // Performance
      ENABLE_CACHE: 'true',
      ENABLE_COMPRESSION: 'true',
      RATE_LIMIT_ENABLED: 'true',
      // Monitoring
      ENABLE_METRICS: 'true',
      ENABLE_HEALTH_CHECKS: 'true',
      HEALTH_CHECK_INTERVAL: '60000',
      // Backup
      BACKUP_ENABLED: 'true',
      BACKUP_SCHEDULE: '0 2 * * *', // 2:00 AM diário
      // Email
      SMTP_HOST: '${SMTP_HOST}',
      SMTP_PORT: '587',
      SMTP_USER: '${SMTP_USER}',
      SMTP_PASS: '${SMTP_PASS}',
      // Digital Ocean
      DO_SPACES_ENDPOINT: '${DO_SPACES_ENDPOINT}',
      DO_SPACES_KEY: '${DO_SPACES_KEY}',
      DO_SPACES_SECRET: '${DO_SPACES_SECRET}',
      DO_SPACES_BUCKET: '${DO_SPACES_BUCKET}'
    };
  }

  /**
   * Executar deploy completo
   */
  async executarDeploy() {
    try {
      console.log('🚀 Iniciando deploy para Digital Ocean...\n');

      // 1. Validações pré-deploy
      await this.validarPreDeploy();

      // 2. Preparar ambiente
      await this.prepararAmbiente();

      // 3. Instalar dependências
      await this.instalarDependencias();

      // 4. Executar testes
      await this.executarTestes();

      // 5. Gerar build de produção
      await this.gerarBuild();

      // 6. Criar pacote de deploy
      const pacote = await this.criarPacoteDeploy();

      // 7. Gerar scripts de deploy
      await this.gerarScriptsDeploy();

      // 8. Criar documentação de deploy
      await this.criarDocumentacaoDeploy();

      console.log('✅ Deploy preparado com sucesso!');
      console.log(`📦 Pacote: ${pacote}`);
      console.log('📋 Próximos passos:');
      console.log('   1. Upload do pacote para Digital Ocean');
      console.log('   2. Configurar variáveis de ambiente');
      console.log('   3. Executar script de instalação');
      console.log('   4. Configurar proxy reverso (Nginx)');
      console.log('   5. Configurar SSL/TLS');
      console.log('   6. Configurar monitoramento');

      return {
        sucesso: true,
        pacote,
        versao: this.deployConfig.versao,
        timestamp: this.deployConfig.timestamp
      };

    } catch (error) {
      console.error('❌ Erro no deploy:', error.message);
      throw error;
    }
  }

  /**
   * Validações pré-deploy
   */
  async validarPreDeploy() {
    console.log('🔍 Executando validações pré-deploy...');

    // Verificar se package.json existe
    const packagePath = path.join(this.projectRoot, 'package.json');
    try {
      await fs.access(packagePath);
    } catch {
      throw new Error('package.json não encontrado');
    }

    // Verificar se app.js existe
    const appPath = path.join(this.projectRoot, 'app.js');
    try {
      await fs.access(appPath);
    } catch {
      throw new Error('app.js não encontrado');
    }

    // Verificar estrutura de pastas essenciais
    const pastasEssenciais = ['config', 'routes', 'services', 'middleware'];
    for (const pasta of pastasEssenciais) {
      const pastaPath = path.join(this.projectRoot, pasta);
      try {
        await fs.access(pastaPath);
      } catch {
        throw new Error(`Pasta essencial não encontrada: ${pasta}`);
      }
    }

    console.log('✅ Validações pré-deploy concluídas');
  }

  /**
   * Preparar ambiente
   */
  async prepararAmbiente() {
    console.log('🔧 Preparando ambiente...');

    // Criar pasta de deploy
    const deployDir = path.join(this.projectRoot, 'deploy');
    await fs.mkdir(deployDir, { recursive: true });

    // Criar pasta de build
    const buildDir = path.join(deployDir, 'build');
    await fs.mkdir(buildDir, { recursive: true });

    // Criar pasta de scripts
    const scriptsDir = path.join(deployDir, 'scripts');
    await fs.mkdir(scriptsDir, { recursive: true });

    console.log('✅ Ambiente preparado');
  }

  /**
   * Instalar dependências
   */
  async instalarDependencias() {
    console.log('📦 Instalando dependências...');

    try {
      execSync('npm ci --only=production', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    } catch (error) {
      throw new Error('Erro ao instalar dependências: ' + error.message);
    }

    console.log('✅ Dependências instaladas');
  }

  /**
   * Executar testes
   */
  async executarTestes() {
    console.log('🧪 Executando testes...');

    try {
      // Verificar se existem testes
      const packageJson = JSON.parse(
        await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf8')
      );

      if (packageJson.scripts && packageJson.scripts.test) {
        execSync('npm test', {
          cwd: this.projectRoot,
          stdio: 'inherit'
        });
      } else {
        console.log('⚠️  Nenhum teste configurado');
      }
    } catch (error) {
      throw new Error('Testes falharam: ' + error.message);
    }

    console.log('✅ Testes executados');
  }

  /**
   * Gerar build de produção
   */
  async gerarBuild() {
    console.log('🏗️  Gerando build de produção...');

    const buildDir = path.join(this.projectRoot, 'deploy', 'build');

    // Copiar arquivos essenciais
    for (const item of this.incluirDeploy) {
      const sourcePath = path.join(this.projectRoot, item);
      const destPath = path.join(buildDir, item);

      try {
        const stats = await fs.stat(sourcePath);
        
        if (stats.isDirectory()) {
          await this.copiarDiretorio(sourcePath, destPath);
        } else {
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(sourcePath, destPath);
        }
      } catch (error) {
        console.warn(`⚠️  Item não encontrado: ${item}`);
      }
    }

    // Criar arquivo .env de produção
    await this.criarEnvProducao(buildDir);

    // Criar package.json otimizado
    await this.criarPackageJsonProducao(buildDir);

    console.log('✅ Build de produção gerado');
  }

  /**
   * Criar pacote de deploy
   */
  async criarPacoteDeploy() {
    console.log('📦 Criando pacote de deploy...');

    const deployDir = path.join(this.projectRoot, 'deploy');
    const buildDir = path.join(deployDir, 'build');
    const pacoteNome = `nfe-backend-${this.deployConfig.versao}-${this.deployConfig.timestamp}.zip`;
    const pacotePath = path.join(deployDir, pacoteNome);

    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(pacotePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`✅ Pacote criado: ${pacoteNome} (${archive.pointer()} bytes)`);
        resolve(pacotePath);
      });

      archive.on('error', reject);
      archive.pipe(output);

      // Adicionar conteúdo do build
      archive.directory(buildDir, false);

      archive.finalize();
    });
  }

  /**
   * Gerar scripts de deploy
   */
  async gerarScriptsDeploy() {
    console.log('📝 Gerando scripts de deploy...');

    const scriptsDir = path.join(this.projectRoot, 'deploy', 'scripts');

    // Script de instalação
    const installScript = this.gerarScriptInstalacao();
    await fs.writeFile(path.join(scriptsDir, 'install.sh'), installScript);

    // Script de start
    const startScript = this.gerarScriptStart();
    await fs.writeFile(path.join(scriptsDir, 'start.sh'), startScript);

    // Script de stop
    const stopScript = this.gerarScriptStop();
    await fs.writeFile(path.join(scriptsDir, 'stop.sh'), stopScript);

    // Script de backup
    const backupScript = this.gerarScriptBackup();
    await fs.writeFile(path.join(scriptsDir, 'backup.sh'), backupScript);

    // Configuração do Nginx
    const nginxConfig = this.gerarConfigNginx();
    await fs.writeFile(path.join(scriptsDir, 'nginx.conf'), nginxConfig);

    // Configuração do PM2
    const pm2Config = this.gerarConfigPM2();
    await fs.writeFile(path.join(scriptsDir, 'ecosystem.config.js'), pm2Config);

    console.log('✅ Scripts de deploy gerados');
  }

  /**
   * Criar documentação de deploy
   */
  async criarDocumentacaoDeploy() {
    console.log('📚 Criando documentação de deploy...');

    const deployDir = path.join(this.projectRoot, 'deploy');
    const readme = this.gerarReadmeDeploy();
    
    await fs.writeFile(path.join(deployDir, 'README.md'), readme);

    console.log('✅ Documentação criada');
  }

  /**
   * Métodos auxiliares
   */
  obterVersao() {
    try {
      const packageJson = require(path.join(this.projectRoot, 'package.json'));
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  async copiarDiretorio(source, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copiarDiretorio(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  async criarEnvProducao(buildDir) {
    const envContent = Object.entries(this.envProducao)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(path.join(buildDir, '.env.production'), envContent);
  }

  async criarPackageJsonProducao(buildDir) {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf8')
    );

    // Remover dependências de desenvolvimento
    delete packageJson.devDependencies;
    
    // Adicionar scripts de produção
    packageJson.scripts = {
      start: 'node app.js',
      'health-check': 'node scripts/health-check.js'
    };

    await fs.writeFile(
      path.join(buildDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  gerarScriptInstalacao() {
    return `#!/bin/bash
# Script de instalação para Digital Ocean

set -e

echo "🚀 Iniciando instalação do NFe Backend..."

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Instalar Nginx
sudo apt install -y nginx

# Criar usuário para aplicação
sudo useradd -m -s /bin/bash nfe-app || true

# Criar diretórios
sudo mkdir -p /opt/nfe-backend
sudo mkdir -p /var/log/nfe-backend
sudo mkdir -p /var/backups/nfe-backend

# Definir permissões
sudo chown -R nfe-app:nfe-app /opt/nfe-backend
sudo chown -R nfe-app:nfe-app /var/log/nfe-backend
sudo chown -R nfe-app:nfe-app /var/backups/nfe-backend

# Extrair aplicação
sudo -u nfe-app unzip -o nfe-backend-*.zip -d /opt/nfe-backend/

# Instalar dependências
cd /opt/nfe-backend
sudo -u nfe-app npm ci --only=production

# Configurar PM2
sudo -u nfe-app pm2 start ecosystem.config.js
sudo -u nfe-app pm2 save
sudo pm2 startup

# Configurar Nginx
sudo cp nginx.conf /etc/nginx/sites-available/nfe-backend
sudo ln -sf /etc/nginx/sites-available/nfe-backend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Configurar firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Instalação concluída!"
echo "📋 Próximos passos:"
echo "   1. Configurar variáveis de ambiente em /opt/nfe-backend/.env"
echo "   2. Configurar SSL/TLS"
echo "   3. Configurar backup automático"
`;
  }

  gerarScriptStart() {
    return `#!/bin/bash
# Script de start da aplicação

cd /opt/nfe-backend
pm2 start ecosystem.config.js
echo "✅ Aplicação iniciada"
`;
  }

  gerarScriptStop() {
    return `#!/bin/bash
# Script de stop da aplicação

pm2 stop all
echo "✅ Aplicação parada"
`;
  }

  gerarScriptBackup() {
    return `#!/bin/bash
# Script de backup automático

BACKUP_DIR="/var/backups/nfe-backend"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_$DATE.tar.gz"

# Criar backup
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \\
  --exclude="node_modules" \\
  --exclude="logs" \\
  --exclude="temp" \\
  /opt/nfe-backend

# Manter apenas últimos 30 backups
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete

echo "✅ Backup criado: $BACKUP_FILE"
`;
  }

  gerarConfigNginx() {
    return `server {
    listen 80;
    server_name _;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/nfe-backend.crt;
    ssl_certificate_key /etc/ssl/private/nfe-backend.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Proxy to Node.js
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health Check
    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:3001/health;
    }

    # Static Files
    location /static/ {
        alias /opt/nfe-backend/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`;
  }

  gerarConfigPM2() {
    return `module.exports = {
  apps: [{
    name: 'nfe-backend',
    script: 'app.js',
    cwd: '/opt/nfe-backend',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/nfe-backend/error.log',
    out_file: '/var/log/nfe-backend/out.log',
    log_file: '/var/log/nfe-backend/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'temp'],
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    listen_timeout: 8000,
    shutdown_with_message: true,
    wait_ready: true
  }]
};`;
  }

  gerarReadmeDeploy() {
    return `# Deploy NFe Backend - Digital Ocean

## Informações do Deploy

- **Versão**: ${this.deployConfig.versao}
- **Timestamp**: ${this.deployConfig.timestamp}
- **Ambiente**: ${this.deployConfig.ambiente}

## Pré-requisitos

- Droplet Digital Ocean (Ubuntu 20.04 LTS ou superior)
- Mínimo 2GB RAM, 2 vCPUs
- 25GB de armazenamento SSD

## Instalação

1. **Upload do pacote**
   \`\`\`bash
   scp nfe-backend-*.zip root@your-server:/tmp/
   \`\`\`

2. **Conectar ao servidor**
   \`\`\`bash
   ssh root@your-server
   \`\`\`

3. **Executar instalação**
   \`\`\`bash
   cd /tmp
   chmod +x scripts/install.sh
   ./scripts/install.sh
   \`\`\`

4. **Configurar variáveis de ambiente**
   \`\`\`bash
   sudo -u nfe-app nano /opt/nfe-backend/.env
   \`\`\`

5. **Reiniciar aplicação**
   \`\`\`bash
   sudo -u nfe-app pm2 restart all
   \`\`\`

## Configuração SSL

1. **Instalar Certbot**
   \`\`\`bash
   sudo apt install certbot python3-certbot-nginx
   \`\`\`

2. **Obter certificado**
   \`\`\`bash
   sudo certbot --nginx -d your-domain.com
   \`\`\`

## Monitoramento

- **PM2 Dashboard**: \`pm2 monit\`
- **Logs**: \`pm2 logs\`
- **Status**: \`pm2 status\`
- **Health Check**: \`curl http://localhost:3001/health\`

## Backup

O backup automático está configurado para executar diariamente às 2:00 AM.

**Backup manual**:
\`\`\`bash
sudo /opt/nfe-backend/scripts/backup.sh
\`\`\`

## Troubleshooting

### Aplicação não inicia
1. Verificar logs: \`pm2 logs\`
2. Verificar configurações: \`cat /opt/nfe-backend/.env\`
3. Verificar permissões: \`ls -la /opt/nfe-backend\`

### Erro de conexão com banco
1. Verificar string de conexão no .env
2. Verificar conectividade: \`ping your-mongodb-host\`
3. Verificar firewall: \`sudo ufw status\`

### Erro 502 Bad Gateway
1. Verificar se aplicação está rodando: \`pm2 status\`
2. Verificar configuração Nginx: \`sudo nginx -t\`
3. Verificar logs Nginx: \`sudo tail -f /var/log/nginx/error.log\`

## Suporte

Para suporte técnico, entre em contato com a equipe de desenvolvimento.
`;
  }
}

// Executar deploy se chamado diretamente
if (require.main === module) {
  const deploy = new DeployService();
  deploy.executarDeploy()
    .then(resultado => {
      console.log('\\n🎉 Deploy concluído com sucesso!');
      console.log(JSON.stringify(resultado, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('\\n💥 Erro no deploy:', error.message);
      process.exit(1);
    });
}

module.exports = DeployService;