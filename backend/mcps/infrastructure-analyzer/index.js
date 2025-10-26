const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * MCP Infrastructure Analyzer
 * Analisa configurações de deploy, Dockerfile, variáveis de ambiente
 * e recursos de infraestrutura
 */
class InfrastructureAnalyzer {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.dockerfilePath = path.join(projectRoot, 'Dockerfile');
    this.dockerComposePath = path.join(projectRoot, 'docker-compose.yml');
    this.envPath = path.join(projectRoot, '.env');
    this.envExamplePath = path.join(projectRoot, '.env.example');
    this.packageJsonPath = path.join(projectRoot, 'package.json');
  }

  /**
   * Executa análise completa de infraestrutura
   */
  async analyze() {
    try {
      const results = {
        dockerfile: await this.analyzeDockerfile(),
        dockerCompose: await this.analyzeDockerCompose(),
        environment: await this.analyzeEnvironmentVariables(),
        deployment: await this.analyzeDeploymentConfigs(),
        resources: await this.analyzeResourceConfigs(),
        security: await this.analyzeInfrastructureSecurity(),
        summary: {}
      };

      results.summary = this.calculateSummary(results);
      
      await this.saveReport(results);
      return results;
    } catch (error) {
      console.error('Erro durante análise de infraestrutura:', error);
      throw error;
    }
  }

  /**
   * Analisa Dockerfile
   */
  async analyzeDockerfile() {
    const issues = [];

    try {
      if (!fs.existsSync(this.dockerfilePath)) {
        issues.push({
          type: 'dockerfile',
          severity: 'medium',
          issue: 'dockerfile_missing',
          description: 'Dockerfile não encontrado',
          recommendation: 'Criar Dockerfile para containerização da aplicação'
        });
        return issues;
      }

      const dockerfileContent = fs.readFileSync(this.dockerfilePath, 'utf8');
      
      // Verificações de boas práticas
      this.checkDockerfileBestPractices(dockerfileContent, issues);
      this.checkDockerfileSecurity(dockerfileContent, issues);
      this.checkDockerfileOptimization(dockerfileContent, issues);

    } catch (error) {
      issues.push({
        type: 'dockerfile',
        severity: 'high',
        issue: 'dockerfile_error',
        description: `Erro ao analisar Dockerfile: ${error.message}`,
        recommendation: 'Verificar sintaxe e estrutura do Dockerfile'
      });
    }

    return issues;
  }

  /**
   * Analisa Docker Compose
   */
  async analyzeDockerCompose() {
    const issues = [];

    try {
      if (!fs.existsSync(this.dockerComposePath)) {
        issues.push({
          type: 'docker_compose',
          severity: 'low',
          issue: 'docker_compose_missing',
          description: 'docker-compose.yml não encontrado',
          recommendation: 'Considerar criar docker-compose.yml para orquestração local'
        });
        return issues;
      }

      const composeContent = fs.readFileSync(this.dockerComposePath, 'utf8');
      const composeConfig = yaml.load(composeContent);

      // Verificações de configuração
      this.checkDockerComposeConfig(composeConfig, issues);
      this.checkDockerComposeServices(composeConfig, issues);
      this.checkDockerComposeNetworks(composeConfig, issues);
      this.checkDockerComposeVolumes(composeConfig, issues);

    } catch (error) {
      issues.push({
        type: 'docker_compose',
        severity: 'medium',
        issue: 'docker_compose_error',
        description: `Erro ao analisar docker-compose.yml: ${error.message}`,
        recommendation: 'Verificar sintaxe YAML e estrutura do docker-compose'
      });
    }

    return issues;
  }

  /**
   * Analisa variáveis de ambiente
   */
  async analyzeEnvironmentVariables() {
    const issues = [];

    try {
      // Verifica .env
      if (!fs.existsSync(this.envPath)) {
        issues.push({
          type: 'environment',
          severity: 'medium',
          issue: 'env_missing',
          description: 'Arquivo .env não encontrado',
          recommendation: 'Criar arquivo .env para configurações locais'
        });
      } else {
        const envContent = fs.readFileSync(this.envPath, 'utf8');
        this.checkEnvironmentVariables(envContent, issues, '.env');
      }

      // Verifica .env.example
      if (!fs.existsSync(this.envExamplePath)) {
        issues.push({
          type: 'environment',
          severity: 'medium',
          issue: 'env_example_missing',
          description: 'Arquivo .env.example não encontrado',
          recommendation: 'Criar .env.example como template para configurações'
        });
      } else {
        const envExampleContent = fs.readFileSync(this.envExamplePath, 'utf8');
        this.checkEnvironmentVariables(envExampleContent, issues, '.env.example');
        
        // Compara .env com .env.example
        if (fs.existsSync(this.envPath)) {
          this.compareEnvFiles(issues);
        }
      }

      // Verifica package.json para scripts de ambiente
      this.checkPackageJsonEnvironment(issues);

    } catch (error) {
      issues.push({
        type: 'environment',
        severity: 'medium',
        issue: 'env_analysis_error',
        description: `Erro ao analisar variáveis de ambiente: ${error.message}`,
        recommendation: 'Verificar arquivos de configuração de ambiente'
      });
    }

    return issues;
  }

  /**
   * Analisa configurações de deployment
   */
  async analyzeDeploymentConfigs() {
    const issues = [];

    try {
      // Verifica configurações de CI/CD
      this.checkCIConfigs(issues);
      
      // Verifica configurações de cloud providers
      this.checkCloudConfigs(issues);
      
      // Verifica configurações de Kubernetes
      this.checkKubernetesConfigs(issues);
      
      // Verifica configurações de Heroku
      this.checkHerokuConfigs(issues);
      
      // Verifica configurações de Vercel/Netlify
      this.checkJamstackConfigs(issues);

    } catch (error) {
      issues.push({
        type: 'deployment',
        severity: 'medium',
        issue: 'deployment_analysis_error',
        description: `Erro ao analisar configurações de deployment: ${error.message}`,
        recommendation: 'Verificar arquivos de configuração de deployment'
      });
    }

    return issues;
  }

  /**
   * Analisa configurações de recursos
   */
  async analyzeResourceConfigs() {
    const issues = [];

    try {
      // Verifica configurações de banco de dados
      this.checkDatabaseConfigs(issues);
      
      // Verifica configurações de cache
      this.checkCacheConfigs(issues);
      
      // Verifica configurações de monitoramento
      this.checkMonitoringConfigs(issues);
      
      // Verifica configurações de logging
      this.checkLoggingConfigs(issues);

    } catch (error) {
      issues.push({
        type: 'resources',
        severity: 'medium',
        issue: 'resources_analysis_error',
        description: `Erro ao analisar configurações de recursos: ${error.message}`,
        recommendation: 'Verificar configurações de recursos da aplicação'
      });
    }

    return issues;
  }

  /**
   * Analisa segurança da infraestrutura
   */
  async analyzeInfrastructureSecurity() {
    const issues = [];

    try {
      // Verifica secrets em arquivos de configuração
      this.checkSecretsInConfigs(issues);
      
      // Verifica configurações de HTTPS
      this.checkHTTPSConfigs(issues);
      
      // Verifica configurações de firewall
      this.checkFirewallConfigs(issues);
      
      // Verifica configurações de backup
      this.checkBackupConfigs(issues);

    } catch (error) {
      issues.push({
        type: 'security',
        severity: 'high',
        issue: 'security_analysis_error',
        description: `Erro ao analisar segurança da infraestrutura: ${error.message}`,
        recommendation: 'Verificar configurações de segurança'
      });
    }

    return issues;
  }

  /**
   * Verifica boas práticas do Dockerfile
   */
  checkDockerfileBestPractices(content, issues) {
    const lines = content.split('\n');

    // Verifica se usa imagem base oficial
    const fromLine = lines.find(line => line.trim().startsWith('FROM'));
    if (fromLine && !fromLine.includes('node:') && !fromLine.includes('alpine')) {
      issues.push({
        type: 'dockerfile',
        severity: 'medium',
        issue: 'unofficial_base_image',
        description: 'Usando imagem base não oficial',
        recommendation: 'Usar imagens oficiais como node:alpine para melhor segurança'
      });
    }

    // Verifica se define USER não-root
    if (!content.includes('USER ') || content.includes('USER root')) {
      issues.push({
        type: 'dockerfile',
        severity: 'high',
        issue: 'running_as_root',
        description: 'Container executando como root',
        recommendation: 'Criar e usar usuário não-root para executar a aplicação'
      });
    }

    // Verifica se usa .dockerignore
    const dockerignorePath = path.join(this.projectRoot, '.dockerignore');
    if (!fs.existsSync(dockerignorePath)) {
      issues.push({
        type: 'dockerfile',
        severity: 'medium',
        issue: 'dockerignore_missing',
        description: 'Arquivo .dockerignore não encontrado',
        recommendation: 'Criar .dockerignore para otimizar build do container'
      });
    }

    // Verifica multi-stage build
    const fromCount = (content.match(/FROM /g) || []).length;
    if (fromCount === 1) {
      issues.push({
        type: 'dockerfile',
        severity: 'low',
        issue: 'single_stage_build',
        description: 'Não está usando multi-stage build',
        recommendation: 'Considerar multi-stage build para reduzir tamanho da imagem'
      });
    }
  }

  /**
   * Verifica segurança do Dockerfile
   */
  checkDockerfileSecurity(content, issues) {
    // Verifica se instala pacotes desnecessários
    if (content.includes('apt-get install') && !content.includes('--no-install-recommends')) {
      issues.push({
        type: 'dockerfile',
        severity: 'medium',
        issue: 'unnecessary_packages',
        description: 'Instalando pacotes recomendados desnecessários',
        recommendation: 'Usar --no-install-recommends para reduzir superfície de ataque'
      });
    }

    // Verifica se limpa cache após instalação
    if (content.includes('apt-get install') && !content.includes('rm -rf /var/lib/apt/lists/*')) {
      issues.push({
        type: 'dockerfile',
        severity: 'low',
        issue: 'cache_not_cleaned',
        description: 'Cache de pacotes não é limpo após instalação',
        recommendation: 'Limpar cache para reduzir tamanho da imagem'
      });
    }

    // Verifica se expõe portas desnecessárias
    const exposePorts = content.match(/EXPOSE\s+(\d+)/g);
    if (exposePorts && exposePorts.length > 2) {
      issues.push({
        type: 'dockerfile',
        severity: 'medium',
        issue: 'too_many_exposed_ports',
        description: 'Muitas portas expostas',
        recommendation: 'Expor apenas portas necessárias'
      });
    }
  }

  /**
   * Verifica otimização do Dockerfile
   */
  checkDockerfileOptimization(content, issues) {
    const lines = content.split('\n').filter(line => line.trim());

    // Verifica se combina comandos RUN
    const runCommands = lines.filter(line => line.trim().startsWith('RUN'));
    if (runCommands.length > 3) {
      issues.push({
        type: 'dockerfile',
        severity: 'low',
        issue: 'multiple_run_commands',
        description: 'Muitos comandos RUN separados',
        recommendation: 'Combinar comandos RUN para reduzir layers'
      });
    }

    // Verifica ordem dos comandos
    const copyIndex = lines.findIndex(line => line.includes('COPY') || line.includes('ADD'));
    const runIndex = lines.findIndex(line => line.startsWith('RUN npm install'));
    
    if (copyIndex > -1 && runIndex > -1 && copyIndex < runIndex) {
      const packageCopyIndex = lines.findIndex(line => 
        line.includes('package.json') || line.includes('package-lock.json')
      );
      
      if (packageCopyIndex === -1 || packageCopyIndex > runIndex) {
        issues.push({
          type: 'dockerfile',
          severity: 'medium',
          issue: 'inefficient_layer_caching',
          description: 'Ordem ineficiente de comandos para cache de layers',
          recommendation: 'Copiar package.json primeiro, depois npm install, depois código'
        });
      }
    }
  }

  /**
   * Verifica configuração do Docker Compose
   */
  checkDockerComposeConfig(config, issues) {
    if (!config.version) {
      issues.push({
        type: 'docker_compose',
        severity: 'medium',
        issue: 'version_missing',
        description: 'Versão do Docker Compose não especificada',
        recommendation: 'Especificar versão do Docker Compose (ex: version: "3.8")'
      });
    }

    if (!config.services || Object.keys(config.services).length === 0) {
      issues.push({
        type: 'docker_compose',
        severity: 'high',
        issue: 'no_services',
        description: 'Nenhum serviço definido no Docker Compose',
        recommendation: 'Definir pelo menos um serviço'
      });
    }
  }

  /**
   * Verifica serviços do Docker Compose
   */
  checkDockerComposeServices(config, issues) {
    if (!config.services) return;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      // Verifica se define restart policy
      if (!service.restart) {
        issues.push({
          type: 'docker_compose',
          severity: 'medium',
          issue: 'no_restart_policy',
          service: serviceName,
          description: `Serviço ${serviceName} sem política de restart`,
          recommendation: 'Definir restart policy (ex: restart: unless-stopped)'
        });
      }

      // Verifica se usa variáveis de ambiente
      if (!service.environment && !service.env_file) {
        issues.push({
          type: 'docker_compose',
          severity: 'low',
          issue: 'no_environment_config',
          service: serviceName,
          description: `Serviço ${serviceName} sem configuração de ambiente`,
          recommendation: 'Considerar usar env_file ou environment'
        });
      }

      // Verifica health check
      if (!service.healthcheck) {
        issues.push({
          type: 'docker_compose',
          severity: 'medium',
          issue: 'no_healthcheck',
          service: serviceName,
          description: `Serviço ${serviceName} sem health check`,
          recommendation: 'Implementar health check para monitoramento'
        });
      }
    });
  }

  /**
   * Verifica redes do Docker Compose
   */
  checkDockerComposeNetworks(config, issues) {
    if (config.services && Object.keys(config.services).length > 1 && !config.networks) {
      issues.push({
        type: 'docker_compose',
        severity: 'low',
        issue: 'no_custom_networks',
        description: 'Múltiplos serviços sem redes customizadas',
        recommendation: 'Considerar criar redes customizadas para isolamento'
      });
    }
  }

  /**
   * Verifica volumes do Docker Compose
   */
  checkDockerComposeVolumes(config, issues) {
    if (!config.services) return;

    const hasDatabase = Object.values(config.services).some(service => 
      service.image && (
        service.image.includes('postgres') ||
        service.image.includes('mysql') ||
        service.image.includes('mongodb') ||
        service.image.includes('redis')
      )
    );

    if (hasDatabase && !config.volumes) {
      issues.push({
        type: 'docker_compose',
        severity: 'high',
        issue: 'database_no_volume',
        description: 'Banco de dados sem volume persistente',
        recommendation: 'Criar volumes para persistência de dados'
      });
    }
  }

  /**
   * Verifica variáveis de ambiente
   */
  checkEnvironmentVariables(content, issues, filename) {
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));

    // Variáveis essenciais para Node.js
    const essentialVars = ['NODE_ENV', 'PORT'];
    const definedVars = lines.map(line => line.split('=')[0].trim());

    essentialVars.forEach(varName => {
      if (!definedVars.includes(varName)) {
        issues.push({
          type: 'environment',
          severity: 'medium',
          issue: 'essential_var_missing',
          file: filename,
          variable: varName,
          description: `Variável essencial ${varName} não definida em ${filename}`,
          recommendation: `Definir ${varName} em ${filename}`
        });
      }
    });

    // Verifica valores suspeitos (possíveis secrets)
    lines.forEach((line, index) => {
      const [key, value] = line.split('=');
      if (value && (
        value.includes('password') ||
        value.includes('secret') ||
        value.includes('key') ||
        value.length > 32
      )) {
        if (filename === '.env') {
          issues.push({
            type: 'environment',
            severity: 'high',
            issue: 'potential_secret_in_env',
            file: filename,
            line: index + 1,
            variable: key,
            description: `Possível secret em ${filename}: ${key}`,
            recommendation: 'Verificar se não há secrets commitados'
          });
        }
      }
    });
  }

  /**
   * Compara arquivos .env e .env.example
   */
  compareEnvFiles(issues) {
    try {
      const envContent = fs.readFileSync(this.envPath, 'utf8');
      const envExampleContent = fs.readFileSync(this.envExamplePath, 'utf8');

      const envVars = new Set(
        envContent.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('=')[0].trim())
      );

      const exampleVars = new Set(
        envExampleContent.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('=')[0].trim())
      );

      // Variáveis em .env mas não em .env.example
      const missingInExample = [...envVars].filter(v => !exampleVars.has(v));
      if (missingInExample.length > 0) {
        issues.push({
          type: 'environment',
          severity: 'medium',
          issue: 'env_example_outdated',
          description: 'Variáveis em .env não estão em .env.example',
          variables: missingInExample,
          recommendation: 'Atualizar .env.example com novas variáveis'
        });
      }

      // Variáveis em .env.example mas não em .env
      const missingInEnv = [...exampleVars].filter(v => !envVars.has(v));
      if (missingInEnv.length > 0) {
        issues.push({
          type: 'environment',
          severity: 'low',
          issue: 'env_missing_vars',
          description: 'Variáveis em .env.example não estão em .env',
          variables: missingInEnv,
          recommendation: 'Verificar se todas as variáveis necessárias estão configuradas'
        });
      }

    } catch (error) {
      console.warn('Erro ao comparar arquivos .env:', error.message);
    }
  }

  /**
   * Verifica configurações de ambiente no package.json
   */
  checkPackageJsonEnvironment(issues) {
    try {
      if (!fs.existsSync(this.packageJsonPath)) return;

      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));

      // Verifica scripts de ambiente
      if (!packageJson.scripts) {
        issues.push({
          type: 'environment',
          severity: 'low',
          issue: 'no_npm_scripts',
          description: 'Nenhum script npm definido',
          recommendation: 'Definir scripts para diferentes ambientes'
        });
        return;
      }

      const scripts = packageJson.scripts;
      const envScripts = ['start', 'dev', 'production', 'test'];
      
      envScripts.forEach(script => {
        if (!scripts[script]) {
          issues.push({
            type: 'environment',
            severity: 'medium',
            issue: 'missing_env_script',
            script: script,
            description: `Script ${script} não definido`,
            recommendation: `Definir script ${script} no package.json`
          });
        }
      });

    } catch (error) {
      console.warn('Erro ao verificar package.json:', error.message);
    }
  }

  /**
   * Verifica configurações de CI/CD
   */
  checkCIConfigs(issues) {
    const ciConfigs = [
      { path: '.github/workflows', name: 'GitHub Actions' },
      { path: '.gitlab-ci.yml', name: 'GitLab CI' },
      { path: '.travis.yml', name: 'Travis CI' },
      { path: 'azure-pipelines.yml', name: 'Azure Pipelines' },
      { path: 'Jenkinsfile', name: 'Jenkins' }
    ];

    const foundConfigs = ciConfigs.filter(config => 
      fs.existsSync(path.join(this.projectRoot, config.path))
    );

    if (foundConfigs.length === 0) {
      issues.push({
        type: 'deployment',
        severity: 'medium',
        issue: 'no_ci_config',
        description: 'Nenhuma configuração de CI/CD encontrada',
        recommendation: 'Configurar pipeline de CI/CD para automação'
      });
    }
  }

  /**
   * Verifica configurações de cloud providers
   */
  checkCloudConfigs(issues) {
    const cloudConfigs = [
      { path: 'vercel.json', name: 'Vercel' },
      { path: 'netlify.toml', name: 'Netlify' },
      { path: 'aws-sam.yml', name: 'AWS SAM' },
      { path: 'serverless.yml', name: 'Serverless Framework' }
    ];

    cloudConfigs.forEach(config => {
      const configPath = path.join(this.projectRoot, config.path);
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf8');
          // Verificações específicas por provider podem ser adicionadas aqui
        } catch (error) {
          issues.push({
            type: 'deployment',
            severity: 'medium',
            issue: 'cloud_config_error',
            provider: config.name,
            description: `Erro ao ler configuração ${config.name}`,
            recommendation: 'Verificar sintaxe do arquivo de configuração'
          });
        }
      }
    });
  }

  /**
   * Verifica configurações do Kubernetes
   */
  checkKubernetesConfigs(issues) {
    const k8sPath = path.join(this.projectRoot, 'k8s');
    if (fs.existsSync(k8sPath)) {
      try {
        const files = fs.readdirSync(k8sPath);
        const yamlFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
        
        if (yamlFiles.length === 0) {
          issues.push({
            type: 'deployment',
            severity: 'medium',
            issue: 'k8s_no_manifests',
            description: 'Diretório k8s existe mas não contém manifests',
            recommendation: 'Criar manifests Kubernetes necessários'
          });
        }
      } catch (error) {
        issues.push({
          type: 'deployment',
          severity: 'medium',
          issue: 'k8s_config_error',
          description: 'Erro ao analisar configurações Kubernetes',
          recommendation: 'Verificar estrutura do diretório k8s'
        });
      }
    }
  }

  /**
   * Verifica configurações do Heroku
   */
  checkHerokuConfigs(issues) {
    const procfilePath = path.join(this.projectRoot, 'Procfile');
    if (fs.existsSync(procfilePath)) {
      try {
        const content = fs.readFileSync(procfilePath, 'utf8');
        if (!content.includes('web:')) {
          issues.push({
            type: 'deployment',
            severity: 'medium',
            issue: 'procfile_no_web',
            description: 'Procfile não define processo web',
            recommendation: 'Definir processo web no Procfile'
          });
        }
      } catch (error) {
        issues.push({
          type: 'deployment',
          severity: 'medium',
          issue: 'procfile_error',
          description: 'Erro ao ler Procfile',
          recommendation: 'Verificar sintaxe do Procfile'
        });
      }
    }
  }

  /**
   * Verifica configurações Jamstack
   */
  checkJamstackConfigs(issues) {
    // Implementação para Vercel, Netlify, etc.
    // Já verificado em checkCloudConfigs
  }

  /**
   * Verifica configurações de banco de dados
   */
  checkDatabaseConfigs(issues) {
    // Verifica se há configurações de banco mas sem Docker
    if (fs.existsSync(this.envPath)) {
      const envContent = fs.readFileSync(this.envPath, 'utf8');
      const hasDbConfig = envContent.includes('DATABASE_URL') || 
                         envContent.includes('DB_HOST') ||
                         envContent.includes('MONGODB_URI');

      if (hasDbConfig && !fs.existsSync(this.dockerComposePath)) {
        issues.push({
          type: 'resources',
          severity: 'medium',
          issue: 'db_no_docker',
          description: 'Configuração de banco sem Docker Compose',
          recommendation: 'Considerar usar Docker Compose para banco local'
        });
      }
    }
  }

  /**
   * Verifica configurações de cache
   */
  checkCacheConfigs(issues) {
    if (fs.existsSync(this.envPath)) {
      const envContent = fs.readFileSync(this.envPath, 'utf8');
      const hasRedisConfig = envContent.includes('REDIS_URL') || 
                            envContent.includes('REDIS_HOST');

      if (!hasRedisConfig) {
        issues.push({
          type: 'resources',
          severity: 'low',
          issue: 'no_cache_config',
          description: 'Nenhuma configuração de cache encontrada',
          recommendation: 'Considerar implementar cache (Redis) para performance'
        });
      }
    }
  }

  /**
   * Verifica configurações de monitoramento
   */
  checkMonitoringConfigs(issues) {
    const monitoringFiles = [
      'prometheus.yml',
      'grafana.yml',
      'newrelic.js'
    ];

    const hasMonitoring = monitoringFiles.some(file => 
      fs.existsSync(path.join(this.projectRoot, file))
    );

    if (!hasMonitoring) {
      issues.push({
        type: 'resources',
        severity: 'medium',
        issue: 'no_monitoring',
        description: 'Nenhuma configuração de monitoramento encontrada',
        recommendation: 'Implementar monitoramento (Prometheus, New Relic, etc.)'
      });
    }
  }

  /**
   * Verifica configurações de logging
   */
  checkLoggingConfigs(issues) {
    if (fs.existsSync(this.packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      const hasLoggingLib = packageJson.dependencies && (
        packageJson.dependencies.winston ||
        packageJson.dependencies.bunyan ||
        packageJson.dependencies.pino
      );

      if (!hasLoggingLib) {
        issues.push({
          type: 'resources',
          severity: 'medium',
          issue: 'no_logging_lib',
          description: 'Nenhuma biblioteca de logging estruturado encontrada',
          recommendation: 'Implementar logging estruturado (Winston, Pino, etc.)'
        });
      }
    }
  }

  /**
   * Verifica secrets em arquivos de configuração
   */
  checkSecretsInConfigs(issues) {
    const configFiles = [
      'docker-compose.yml',
      'k8s/*.yml',
      'k8s/*.yaml'
    ];

    configFiles.forEach(pattern => {
      // Implementação simplificada - em produção usaria glob
      const filePath = path.join(this.projectRoot, pattern);
      if (fs.existsSync(filePath) && !pattern.includes('*')) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('password:') || content.includes('secret:')) {
            issues.push({
              type: 'security',
              severity: 'high',
              issue: 'secrets_in_config',
              file: pattern,
              description: `Possíveis secrets em ${pattern}`,
              recommendation: 'Usar secrets management ou variáveis de ambiente'
            });
          }
        } catch (error) {
          // Ignora erros de leitura
        }
      }
    });
  }

  /**
   * Verifica configurações de HTTPS
   */
  checkHTTPSConfigs(issues) {
    // Verifica se há configuração de SSL/TLS
    if (fs.existsSync(this.envPath)) {
      const envContent = fs.readFileSync(this.envPath, 'utf8');
      const hasSSLConfig = envContent.includes('SSL_') || 
                          envContent.includes('HTTPS_') ||
                          envContent.includes('TLS_');

      if (!hasSSLConfig) {
        issues.push({
          type: 'security',
          severity: 'medium',
          issue: 'no_ssl_config',
          description: 'Nenhuma configuração SSL/TLS encontrada',
          recommendation: 'Configurar HTTPS para produção'
        });
      }
    }
  }

  /**
   * Verifica configurações de firewall
   */
  checkFirewallConfigs(issues) {
    // Verifica se há configurações de segurança de rede
    const securityFiles = [
      'security-groups.yml',
      'firewall.rules',
      'iptables.conf'
    ];

    const hasFirewallConfig = securityFiles.some(file => 
      fs.existsSync(path.join(this.projectRoot, file))
    );

    if (!hasFirewallConfig) {
      issues.push({
        type: 'security',
        severity: 'low',
        issue: 'no_firewall_config',
        description: 'Nenhuma configuração de firewall encontrada',
        recommendation: 'Documentar regras de firewall necessárias'
      });
    }
  }

  /**
   * Verifica configurações de backup
   */
  checkBackupConfigs(issues) {
    const backupFiles = [
      'backup.sh',
      'backup.yml',
      'backup-config.json'
    ];

    const hasBackupConfig = backupFiles.some(file => 
      fs.existsSync(path.join(this.projectRoot, file))
    );

    if (!hasBackupConfig) {
      issues.push({
        type: 'security',
        severity: 'medium',
        issue: 'no_backup_config',
        description: 'Nenhuma configuração de backup encontrada',
        recommendation: 'Implementar estratégia de backup para dados críticos'
      });
    }
  }

  /**
   * Calcula resumo da análise
   */
  calculateSummary(results) {
    const allIssues = [
      ...results.dockerfile,
      ...results.dockerCompose,
      ...results.environment,
      ...results.deployment,
      ...results.resources,
      ...results.security
    ];

    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    const typeCounts = {
      dockerfile: results.dockerfile.length,
      dockerCompose: results.dockerCompose.length,
      environment: results.environment.length,
      deployment: results.deployment.length,
      resources: results.resources.length,
      security: results.security.length
    };

    allIssues.forEach(issue => {
      severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
    });

    return {
      totalIssues: allIssues.length,
      severityCounts,
      typeCounts,
      infrastructureScore: this.calculateInfrastructureScore(severityCounts, typeCounts)
    };
  }

  /**
   * Calcula score de infraestrutura
   */
  calculateInfrastructureScore(severityCounts, typeCounts) {
    const maxScore = 100;
    const penalties = {
      critical: 20,
      high: 10,
      medium: 5,
      low: 2
    };

    const totalPenalty = Object.entries(severityCounts).reduce((total, [severity, count]) => {
      return total + (count * (penalties[severity] || 0));
    }, 0);

    return Math.max(0, maxScore - totalPenalty);
  }

  /**
   * Gera recomendações baseadas nos resultados
   */
  generateRecommendations(results) {
    const recommendations = [];

    if (results.dockerfile.length > 0) {
      recommendations.push({
        category: 'Docker',
        priority: 'high',
        action: 'Otimizar Dockerfile seguindo boas práticas',
        items: results.dockerfile.map(issue => issue.recommendation)
      });
    }

    if (results.security.length > 0) {
      recommendations.push({
        category: 'Segurança',
        priority: 'critical',
        action: 'Corrigir problemas de segurança da infraestrutura',
        items: results.security.map(issue => issue.recommendation)
      });
    }

    if (results.deployment.length > 0) {
      recommendations.push({
        category: 'Deploy',
        priority: 'medium',
        action: 'Configurar pipeline de deployment',
        items: results.deployment.map(issue => issue.recommendation)
      });
    }

    return recommendations;
  }

  /**
   * Salva relatório em arquivo
   */
  async saveReport(results) {
    try {
      const reportPath = path.join(this.projectRoot, 'infrastructure-analysis-report.json');
      const report = {
        timestamp: new Date().toISOString(),
        projectRoot: this.projectRoot,
        results,
        recommendations: this.generateRecommendations(results)
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`Relatório de análise de infraestrutura salvo em: ${reportPath}`);
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
    }
  }
}

module.exports = InfrastructureAnalyzer;