const fs = require('fs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');
const yaml = require('js-yaml');

class APIDocumentationGenerator {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.routesDir = path.join(projectRoot, 'routes');
    this.controllersDir = path.join(projectRoot, 'controllers');
    this.middlewareDir = path.join(projectRoot, 'middleware');
    this.modelsDir = path.join(projectRoot, 'models');
    this.docsDir = path.join(projectRoot, 'docs');
    this.packageJsonPath = path.join(projectRoot, 'package.json');
    
    this.swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'API Documentation',
          version: '1.0.0',
          description: 'Documentação automática da API'
        },
        servers: [
          {
            url: 'http://localhost:3000',
            description: 'Servidor de desenvolvimento'
          }
        ]
      },
      apis: [
        path.join(this.routesDir, '*.js'),
        path.join(this.controllersDir, '*.js'),
        path.join(this.modelsDir, '*.js')
      ]
    };
  }

  async analyze() {
    try {
      console.log('🔍 Iniciando análise de documentação da API...');

      const results = {
        endpoints: await this.analyzeEndpoints(),
        schemas: await this.analyzeSchemas(),
        documentation: await this.analyzeDocumentation(),
        validation: await this.validateDocumentation(),
        coverage: await this.calculateDocumentationCoverage(),
        breakingChanges: await this.detectBreakingChanges(),
        recommendations: [],
        summary: {}
      };

      results.recommendations = this.generateRecommendations(results);
      results.summary = this.calculateSummary(results);

      await this.saveReport(results);
      await this.generateSwaggerSpec(results);

      console.log('✅ Análise de documentação da API concluída');
      return results;

    } catch (error) {
      console.error('❌ Erro durante análise de documentação:', error.message);
      throw error;
    }
  }

  async analyzeEndpoints() {
    const issues = [];
    const endpoints = [];

    try {
      const routeFiles = this.getRouteFiles();
      
      for (const file of routeFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const fileEndpoints = this.extractEndpoints(content, file);
        endpoints.push(...fileEndpoints);
        
        this.analyzeEndpointDocumentation(content, file, issues);
      }

      this.analyzeEndpointConsistency(endpoints, issues);
      this.analyzeParameterValidation(endpoints, issues);
      this.analyzeResponseDocumentation(endpoints, issues);

    } catch (error) {
      issues.push({
        type: 'endpoints',
        severity: 'high',
        issue: 'analysis_error',
        message: `Erro ao analisar endpoints: ${error.message}`,
        file: 'routes'
      });
    }

    return { issues, endpoints };
  }

  getRouteFiles() {
    const files = [];
    
    if (fs.existsSync(this.routesDir)) {
      const routeFiles = fs.readdirSync(this.routesDir)
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(this.routesDir, file));
      files.push(...routeFiles);
    }

    if (fs.existsSync(this.controllersDir)) {
      const controllerFiles = fs.readdirSync(this.controllersDir)
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(this.controllersDir, file));
      files.push(...controllerFiles);
    }

    return files;
  }

  extractEndpoints(content, filePath) {
    const endpoints = [];
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
    
    // Padrões para detectar rotas
    const routePatterns = [
      /router\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /app\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /express\(\)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g
    ];

    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, method, path] = match;
        
        endpoints.push({
          method: method.toUpperCase(),
          path: path,
          file: filePath,
          line: this.getLineNumber(content, match.index),
          hasSwaggerDoc: this.hasSwaggerDocumentation(content, match.index),
          hasValidation: this.hasParameterValidation(content, match.index),
          hasErrorHandling: this.hasErrorHandling(content, match.index)
        });
      }
    }

    return endpoints;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  hasSwaggerDocumentation(content, routeIndex) {
    // Procura por comentários Swagger imediatamente antes da rota
    const beforeRoute = content.substring(0, routeIndex);
    const lines = beforeRoute.split('\n');
    
    // Verifica as últimas 10 linhas antes da rota
    const checkLines = lines.slice(-10);
    
    // Procura pelo último bloco de comentário que contenha @swagger
    let lastSwaggerBlockEnd = -1;
    let inSwaggerBlock = false;
    let foundSwagger = false;
    
    for (let i = 0; i < checkLines.length; i++) {
      const line = checkLines[i].trim();
      
      // Início de bloco de comentário
      if (line.includes('/**')) {
        inSwaggerBlock = true;
        foundSwagger = false;
      }
      
      // Verifica se há @swagger no bloco atual
      if (inSwaggerBlock && (line.includes('@swagger') || line.includes('@openapi') || line.includes('@api'))) {
        foundSwagger = true;
      }
      
      // Fim do bloco de comentário
      if (line.includes('*/')) {
        if (inSwaggerBlock && foundSwagger) {
          lastSwaggerBlockEnd = i;
        }
        inSwaggerBlock = false;
        foundSwagger = false;
      }
    }
    
    // Se encontrou um bloco Swagger, verifica se está próximo o suficiente da rota
    if (lastSwaggerBlockEnd >= 0) {
      // Verifica se há apenas linhas vazias ou comentários entre o fim do bloco e a rota
      const linesAfterBlock = checkLines.slice(lastSwaggerBlockEnd + 1);
      
      // Não deve haver outras rotas entre o bloco Swagger e a rota atual
      for (const line of linesAfterBlock) {
        const trimmedLine = line.trim();
        if (trimmedLine !== '' && 
            (trimmedLine.includes('router.') || 
             trimmedLine.includes('app.') || 
             trimmedLine.includes('express.'))) {
          return false; // Há outra rota entre o bloco e a rota atual
        }
      }
      
      return true;
    }
    
    return false;
  }

  hasParameterValidation(content, routeIndex) {
    // Encontra a definição completa da rota
    const routeMatch = content.substring(routeIndex).match(/router\.\w+\s*\([^)]*\)/);
    if (!routeMatch) return false;
    
    const routeDefinition = routeMatch[0];
    
    // Verifica se há middleware de validação na definição da rota
    const hasValidationMiddleware = /celebrate\s*\(/.test(routeDefinition) ||
                                   /check\s*\(/.test(routeDefinition) ||
                                   /body\s*\(/.test(routeDefinition) ||
                                   /param\s*\(/.test(routeDefinition) ||
                                   /query\s*\(/.test(routeDefinition);
    
    // Verifica se há schema sendo usado como middleware na rota
    const hasSchemaMiddleware = /\w+Schema\s*[,\)]/.test(routeDefinition);
    
    // Se não encontrou na definição da rota, verifica no contexto da função
    if (!hasValidationMiddleware && !hasSchemaMiddleware) {
      const functionContext = this.getRouteContext(content, routeIndex, 200);
      
      // Verifica se há chamadas de validação dentro da função
      const hasValidationCall = /\.validate\s*\(/.test(functionContext) ||
                               /\.validateAsync\s*\(/.test(functionContext);
      
      return hasValidationCall;
    }
    
    return hasValidationMiddleware || hasSchemaMiddleware;
  }

  hasErrorHandling(content, routeIndex) {
    // Encontra a definição completa da rota incluindo a função handler
    const routeStart = routeIndex;
    const routeContent = content.substring(routeStart);
    
    // Procura pelo padrão da rota e sua função
    const routeMatch = routeContent.match(/router\.\w+\s*\([^,]+,\s*(?:.*?,\s*)*(async\s+)?\([^)]*\)\s*=>\s*{[\s\S]*?^[ \t]*}\s*\)/m);
    
    if (!routeMatch) {
      // Tenta padrão de função nomeada
      const namedFunctionMatch = routeContent.match(/router\.\w+\s*\([^,]+,\s*(?:.*?,\s*)*(?:async\s+)?function[^{]*{[\s\S]*?^[ \t]*}\s*\)/m);
      if (!namedFunctionMatch) return false;
      
      const functionBody = namedFunctionMatch[0];
      return this.checkErrorHandlingInFunction(functionBody);
    }
    
    const functionBody = routeMatch[0];
    return this.checkErrorHandlingInFunction(functionBody);
  }
  
  checkErrorHandlingInFunction(functionBody) {
    // Verifica se há try/catch block
    const hasTryCatch = /try\s*{[\s\S]*?catch\s*\(/m.test(functionBody);
    
    // Verifica se há .catch() para promises
    const hasPromiseCatch = /\.catch\s*\(/m.test(functionBody);
    
    // Verifica se há next() com parâmetro (erro)
    const hasNext = /next\s*\(\s*\w/.test(functionBody);
    
    return hasTryCatch || hasPromiseCatch || hasNext;
  }

  getRouteContext(content, routeIndex, contextSize = 500) {
    const start = Math.max(0, routeIndex - contextSize);
    const end = Math.min(content.length, routeIndex + contextSize);
    return content.substring(start, end);
  }

  analyzeEndpointDocumentation(content, filePath, issues) {
    const endpoints = this.extractEndpoints(content, filePath);
    
    for (const endpoint of endpoints) {
      if (!endpoint.hasSwaggerDoc) {
        issues.push({
          type: 'endpoints',
          severity: 'medium',
          issue: 'missing_swagger_doc',
          message: `Endpoint ${endpoint.method} ${endpoint.path} não possui documentação Swagger`,
          file: path.relative(this.projectRoot, filePath),
          line: endpoint.line,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          recommendation: 'Adicionar comentários @swagger para documentar o endpoint'
        });
      }

      if (!endpoint.hasValidation) {
        issues.push({
          type: 'endpoints',
          severity: 'medium',
          issue: 'missing_validation',
          message: `Endpoint ${endpoint.method} ${endpoint.path} não possui validação de parâmetros`,
          file: path.relative(this.projectRoot, filePath),
          line: endpoint.line,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          recommendation: 'Implementar validação de entrada usando Joi, Yup ou express-validator'
        });
      }

      if (!endpoint.hasErrorHandling) {
        issues.push({
          type: 'endpoints',
          severity: 'high',
          issue: 'missing_error_handling',
          message: `Endpoint ${endpoint.method} ${endpoint.path} não possui tratamento de erro adequado`,
          file: path.relative(this.projectRoot, filePath),
          line: endpoint.line,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          recommendation: 'Implementar try-catch ou middleware de tratamento de erro'
        });
      }
    }
  }

  analyzeEndpointConsistency(endpoints, issues) {
    // Verifica consistência de nomenclatura
    const pathPatterns = endpoints.map(e => e.path);
    const inconsistentPaths = this.findInconsistentNaming(pathPatterns);
    
    if (inconsistentPaths.length > 0) {
      issues.push({
        type: 'endpoints',
        severity: 'low',
        issue: 'inconsistent_naming',
        message: 'Nomenclatura inconsistente nos endpoints',
        paths: inconsistentPaths,
        recommendation: 'Padronizar nomenclatura usando kebab-case ou camelCase consistentemente'
      });
    }

    // Verifica versionamento
    const versionedEndpoints = endpoints.filter(e => /\/v\d+\//.test(e.path));
    const unversionedEndpoints = endpoints.filter(e => !/\/v\d+\//.test(e.path));
    
    if (versionedEndpoints.length > 0 && unversionedEndpoints.length > 0) {
      issues.push({
        type: 'endpoints',
        severity: 'medium',
        issue: 'inconsistent_versioning',
        message: 'Alguns endpoints têm versionamento e outros não',
        versionedCount: versionedEndpoints.length,
        unversionedCount: unversionedEndpoints.length,
        recommendation: 'Implementar versionamento consistente em todos os endpoints'
      });
    }
  }

  findInconsistentNaming(paths) {
    const kebabCase = paths.filter(p => /^\/[a-z0-9-\/]+$/.test(p));
    const camelCase = paths.filter(p => /[A-Z]/.test(p));
    const snakeCase = paths.filter(p => /_/.test(p));
    
    const patterns = [
      { name: 'kebab-case', count: kebabCase.length },
      { name: 'camelCase', count: camelCase.length },
      { name: 'snake_case', count: snakeCase.length }
    ];
    
    const dominantPattern = patterns.reduce((a, b) => a.count > b.count ? a : b);
    
    if (dominantPattern.count < paths.length * 0.8) {
      return paths.filter(p => {
        if (dominantPattern.name === 'kebab-case') return !/^\/[a-z0-9-\/]+$/.test(p);
        if (dominantPattern.name === 'camelCase') return !/[A-Z]/.test(p);
        if (dominantPattern.name === 'snake_case') return !/_/.test(p);
        return false;
      });
    }
    
    return [];
  }

  analyzeParameterValidation(endpoints, issues) {
    const endpointsWithParams = endpoints.filter(e => 
      e.path.includes(':') || ['POST', 'PUT', 'PATCH'].includes(e.method)
    );

    const unvalidatedEndpoints = endpointsWithParams.filter(e => !e.hasValidation);
    
    if (unvalidatedEndpoints.length > 0) {
      issues.push({
        type: 'endpoints',
        severity: 'high',
        issue: 'missing_parameter_validation',
        message: `${unvalidatedEndpoints.length} endpoints com parâmetros não possuem validação`,
        count: unvalidatedEndpoints.length,
        total: endpointsWithParams.length,
        recommendation: 'Implementar validação de parâmetros em todos os endpoints que recebem dados'
      });
    }
  }

  analyzeResponseDocumentation(endpoints, issues) {
    // Esta análise seria mais precisa com parsing AST, mas fazemos uma análise básica
    const endpointsWithoutResponseDoc = endpoints.filter(e => !e.hasSwaggerDoc);
    
    if (endpointsWithoutResponseDoc.length > 0) {
      issues.push({
        type: 'endpoints',
        severity: 'medium',
        issue: 'missing_response_documentation',
        message: `${endpointsWithoutResponseDoc.length} endpoints não documentam suas respostas`,
        count: endpointsWithoutResponseDoc.length,
        total: endpoints.length,
        recommendation: 'Documentar todos os códigos de resposta possíveis e seus schemas'
      });
    }
  }

  async analyzeSchemas() {
    const issues = [];
    const schemas = [];

    try {
      // Analisa modelos/schemas existentes
      if (fs.existsSync(this.modelsDir)) {
        const modelFiles = fs.readdirSync(this.modelsDir)
          .filter(file => file.endsWith('.js'))
          .map(file => path.join(this.modelsDir, file));

        for (const file of modelFiles) {
          const content = fs.readFileSync(file, 'utf8');
          const fileSchemas = this.extractSchemas(content, file);
          schemas.push(...fileSchemas);
          
          this.analyzeSchemaDocumentation(content, file, issues);
        }
      }

      this.analyzeSchemaConsistency(schemas, issues);
      this.analyzeSchemaValidation(schemas, issues);

    } catch (error) {
      issues.push({
        type: 'schemas',
        severity: 'high',
        issue: 'analysis_error',
        message: `Erro ao analisar schemas: ${error.message}`,
        file: 'models'
      });
    }

    return { issues, schemas };
  }

  extractSchemas(content, filePath) {
    const schemas = [];
    
    // Detecta schemas Mongoose
    const mongooseSchemas = content.match(/new\s+Schema\s*\(\s*{[\s\S]*?}\s*\)/g) || [];
    mongooseSchemas.forEach((schema, index) => {
      schemas.push({
        type: 'mongoose',
        name: this.extractSchemaName(content, schema),
        file: filePath,
        definition: schema,
        hasValidation: /required:\s*true|validate:/.test(schema),
        hasDocumentation: /\/\*\*[\s\S]*?\*\//.test(schema)
      });
    });

    // Detecta schemas Joi
    const joiSchemas = content.match(/Joi\.\w+\(\)[\s\S]*?;/g) || [];
    joiSchemas.forEach((schema, index) => {
      schemas.push({
        type: 'joi',
        name: this.extractJoiSchemaName(content, schema),
        file: filePath,
        definition: schema,
        hasValidation: true,
        hasDocumentation: /\/\*\*[\s\S]*?\*\//.test(schema)
      });
    });

    return schemas;
  }

  extractSchemaName(content, schemaDefinition) {
    // Tenta extrair o nome do schema baseado no contexto
    const schemaIndex = content.indexOf(schemaDefinition);
    const beforeSchema = content.substring(0, schemaIndex);
    const lines = beforeSchema.split('\n');
    
    // Procura por declarações de variável ou constante
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const match = line.match(/(const|let|var)\s+(\w+)/);
      if (match) {
        return match[2];
      }
    }
    
    return 'UnnamedSchema';
  }

  extractJoiSchemaName(content, schemaDefinition) {
    const schemaIndex = content.indexOf(schemaDefinition);
    const beforeSchema = content.substring(0, schemaIndex);
    const match = beforeSchema.match(/(const|let|var)\s+(\w+)\s*=/);
    return match ? match[2] : 'UnnamedJoiSchema';
  }

  analyzeSchemaDocumentation(content, filePath, issues) {
    const schemas = this.extractSchemas(content, filePath);
    
    for (const schema of schemas) {
      if (!schema.hasDocumentation) {
        issues.push({
          type: 'schemas',
          severity: 'medium',
          issue: 'missing_schema_documentation',
          message: `Schema ${schema.name} não possui documentação`,
          file: path.relative(this.projectRoot, filePath),
          schema: schema.name,
          recommendation: 'Adicionar comentários JSDoc para documentar o schema'
        });
      }

      if (!schema.hasValidation && schema.type === 'mongoose') {
        issues.push({
          type: 'schemas',
          severity: 'medium',
          issue: 'missing_schema_validation',
          message: `Schema ${schema.name} não possui validações adequadas`,
          file: path.relative(this.projectRoot, filePath),
          schema: schema.name,
          recommendation: 'Adicionar validações required, type, min, max conforme necessário'
        });
      }
    }
  }

  analyzeSchemaConsistency(schemas, issues) {
    // Verifica consistência de nomenclatura
    const schemaNames = schemas.map(s => s.name);
    const inconsistentNames = this.findInconsistentSchemaNames(schemaNames);
    
    if (inconsistentNames.length > 0) {
      issues.push({
        type: 'schemas',
        severity: 'low',
        issue: 'inconsistent_schema_naming',
        message: 'Nomenclatura inconsistente nos schemas',
        schemas: inconsistentNames,
        recommendation: 'Padronizar nomenclatura usando PascalCase para schemas'
      });
    }

    // Verifica duplicação de schemas similares
    const duplicatedSchemas = this.findDuplicatedSchemas(schemas);
    if (duplicatedSchemas.length > 0) {
      issues.push({
        type: 'schemas',
        severity: 'medium',
        issue: 'duplicated_schemas',
        message: 'Schemas similares detectados',
        schemas: duplicatedSchemas,
        recommendation: 'Considerar consolidar schemas similares ou criar schemas base'
      });
    }
  }

  findInconsistentSchemaNames(names) {
    if (!names || names.length === 0) return [];
    
    const pascalCase = names.filter(name => /^[A-Z][a-zA-Z0-9]*$/.test(name));
    const camelCase = names.filter(name => /^[a-z][a-zA-Z0-9]*$/.test(name));
    const otherCase = names.filter(name => 
      !/^[A-Z][a-zA-Z0-9]*$/.test(name) && !/^[a-z][a-zA-Z0-9]*$/.test(name)
    );
    
    // Se há nomes que não seguem nem PascalCase nem camelCase, retorna eles
    if (otherCase.length > 0) {
      return otherCase;
    }
    
    // Se há mistura de PascalCase e camelCase, retorna o padrão minoritário
    if (pascalCase.length > 0 && camelCase.length > 0) {
      if (pascalCase.length > camelCase.length) {
        return camelCase;
      } else {
        return pascalCase;
      }
    }
    
    return [];
  }

  findDuplicatedSchemas(schemas) {
    const duplicates = [];
    
    for (let i = 0; i < schemas.length; i++) {
      for (let j = i + 1; j < schemas.length; j++) {
        const similarity = this.calculateSchemaSimilarity(schemas[i], schemas[j]);
        if (similarity > 0.8) {
          duplicates.push({
            schema1: schemas[i].name,
            schema2: schemas[j].name,
            similarity: similarity
          });
        }
      }
    }
    
    return duplicates;
  }

  calculateSchemaSimilarity(schema1, schema2) {
    // Análise simples baseada em palavras-chave comuns
    const words1 = schema1.definition.match(/\w+/g) || [];
    const words2 = schema2.definition.match(/\w+/g) || [];
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  analyzeSchemaValidation(schemas, issues) {
    const schemasWithoutValidation = schemas.filter(s => !s.hasValidation);
    
    if (schemasWithoutValidation.length > 0) {
      issues.push({
        type: 'schemas',
        severity: 'high',
        issue: 'schemas_without_validation',
        message: `${schemasWithoutValidation.length} schemas não possuem validação adequada`,
        count: schemasWithoutValidation.length,
        total: schemas.length,
        recommendation: 'Implementar validações em todos os schemas para garantir integridade dos dados'
      });
    }
  }

  async analyzeDocumentation() {
    const issues = [];
    
    try {
      // Verifica existência de documentação
      this.checkDocumentationFiles(issues);
      this.checkSwaggerSetup(issues);
      this.checkAPIExamples(issues);
      this.checkDocumentationStructure(issues);

    } catch (error) {
      issues.push({
        type: 'documentation',
        severity: 'high',
        issue: 'analysis_error',
        message: `Erro ao analisar documentação: ${error.message}`
      });
    }

    return issues;
  }

  checkDocumentationFiles(issues) {
    const requiredDocs = [
      { file: 'README.md', severity: 'high' },
      { file: 'API.md', severity: 'medium' },
      { file: 'CHANGELOG.md', severity: 'low' },
      { file: path.join('docs', 'api.md'), severity: 'medium' }
    ];

    for (const doc of requiredDocs) {
      const filePath = path.join(this.projectRoot, doc.file);
      if (!fs.existsSync(filePath)) {
        issues.push({
          type: 'documentation',
          severity: doc.severity,
          issue: 'missing_documentation_file',
          message: `Arquivo de documentação ${doc.file} não encontrado`,
          file: doc.file,
          recommendation: `Criar arquivo ${doc.file} com documentação adequada`
        });
      }
    }
  }

  checkSwaggerSetup(issues) {
    const packageJsonExists = fs.existsSync(this.packageJsonPath);
    
    if (packageJsonExists) {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      const hasSwagger = dependencies['swagger-jsdoc'] || dependencies['swagger-ui-express'];
      
      if (!hasSwagger) {
        issues.push({
          type: 'documentation',
          severity: 'medium',
          issue: 'missing_swagger_setup',
          message: 'Swagger não está configurado no projeto',
          recommendation: 'Instalar e configurar swagger-jsdoc e swagger-ui-express'
        });
      }
    }

    // Verifica se existe configuração do Swagger
    const swaggerConfigFiles = [
      'swagger.js',
      'swagger.config.js',
      path.join('config', 'swagger.js')
    ];

    const hasSwaggerConfig = swaggerConfigFiles.some(file => 
      fs.existsSync(path.join(this.projectRoot, file))
    );

    if (!hasSwaggerConfig) {
      issues.push({
        type: 'documentation',
        severity: 'medium',
        issue: 'missing_swagger_config',
        message: 'Configuração do Swagger não encontrada',
        recommendation: 'Criar arquivo de configuração do Swagger'
      });
    }
  }

  checkAPIExamples(issues) {
    const examplesDir = path.join(this.docsDir, 'examples');
    
    if (!fs.existsSync(examplesDir)) {
      issues.push({
        type: 'documentation',
        severity: 'low',
        issue: 'missing_api_examples',
        message: 'Exemplos de uso da API não encontrados',
        recommendation: 'Criar diretório docs/examples com exemplos de requests/responses'
      });
    }
  }

  checkDocumentationStructure(issues) {
    if (!fs.existsSync(this.docsDir)) {
      issues.push({
        type: 'documentation',
        severity: 'medium',
        issue: 'missing_docs_directory',
        message: 'Diretório de documentação não encontrado',
        recommendation: 'Criar estrutura de documentação organizada em diretório docs/'
      });
    }
  }

  async validateDocumentation() {
    const issues = [];
    
    try {
      // Tenta gerar especificação Swagger para validar
      const spec = swaggerJSDoc(this.swaggerOptions);
      
      if (!spec || !spec.paths || Object.keys(spec.paths).length === 0) {
        issues.push({
          type: 'validation',
          severity: 'high',
          issue: 'invalid_swagger_spec',
          message: 'Especificação Swagger inválida ou vazia',
          recommendation: 'Verificar comentários @swagger nos arquivos de rota'
        });
      }

      this.validateSwaggerPaths(spec, issues);
      this.validateSwaggerSchemas(spec, issues);

    } catch (error) {
      issues.push({
        type: 'validation',
        severity: 'high',
        issue: 'swagger_generation_error',
        message: `Erro ao gerar especificação Swagger: ${error.message}`,
        recommendation: 'Verificar sintaxe dos comentários @swagger'
      });
    }

    return issues;
  }

  validateSwaggerPaths(spec, issues) {
    if (!spec.paths) return;

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!operation.summary) {
          issues.push({
            type: 'validation',
            severity: 'medium',
            issue: 'missing_operation_summary',
            message: `Operação ${method.toUpperCase()} ${path} não possui summary`,
            endpoint: `${method.toUpperCase()} ${path}`,
            recommendation: 'Adicionar summary descritivo para a operação'
          });
        }

        if (!operation.responses || Object.keys(operation.responses).length === 0) {
          issues.push({
            type: 'validation',
            severity: 'high',
            issue: 'missing_operation_responses',
            message: `Operação ${method.toUpperCase()} ${path} não documenta respostas`,
            endpoint: `${method.toUpperCase()} ${path}`,
            recommendation: 'Documentar todos os códigos de resposta possíveis'
          });
        }
      }
    }
  }

  validateSwaggerSchemas(spec, issues) {
    if (!spec.components || !spec.components.schemas) {
      issues.push({
        type: 'validation',
        severity: 'medium',
        issue: 'missing_schemas',
        message: 'Nenhum schema definido na especificação',
        recommendation: 'Definir schemas para requests e responses'
      });
    }
  }

  async calculateDocumentationCoverage() {
    const coverage = {
      endpoints: 0,
      schemas: 0,
      examples: 0,
      overall: 0
    };

    try {
      const endpointsResult = await this.analyzeEndpoints();
      const endpoints = endpointsResult.endpoints || [];
      
      if (endpoints.length > 0) {
        const documentedEndpoints = endpoints.filter(e => e.hasSwaggerDoc);
        coverage.endpoints = Math.round((documentedEndpoints.length / endpoints.length) * 100);
      }

      const schemasResult = await this.analyzeSchemas();
      const schemas = schemasResult.schemas || [];
      
      if (schemas.length > 0) {
        const documentedSchemas = schemas.filter(s => s.hasDocumentation);
        coverage.schemas = Math.round((documentedSchemas.length / schemas.length) * 100);
      }

      // Verifica exemplos
      const examplesDir = path.join(this.docsDir, 'examples');
      coverage.examples = fs.existsSync(examplesDir) ? 100 : 0;

      // Calcula cobertura geral
      coverage.overall = Math.round((coverage.endpoints + coverage.schemas + coverage.examples) / 3);

    } catch (error) {
      console.error('Erro ao calcular cobertura de documentação:', error.message);
    }

    return coverage;
  }

  async detectBreakingChanges() {
    const issues = [];
    
    try {
      // Esta funcionalidade seria mais robusta com histórico de versões
      // Por enquanto, fazemos verificações básicas
      
      const changelogPath = path.join(this.projectRoot, 'CHANGELOG.md');
      if (fs.existsSync(changelogPath)) {
        const changelog = fs.readFileSync(changelogPath, 'utf8');
        
        // Procura por indicadores de breaking changes
        const breakingChangeIndicators = [
          /BREAKING CHANGE/gi,
          /breaking:/gi,
          /\[BREAKING\]/gi,
          /major:/gi
        ];

        const hasBreakingChanges = breakingChangeIndicators.some(pattern => 
          pattern.test(changelog)
        );

        if (hasBreakingChanges) {
          issues.push({
            type: 'breaking_changes',
            severity: 'high',
            issue: 'breaking_changes_detected',
            message: 'Breaking changes detectadas no changelog',
            recommendation: 'Documentar breaking changes adequadamente e considerar versionamento'
          });
        }
      }

      // Verifica versionamento da API
      const packageJsonExists = fs.existsSync(this.packageJsonPath);
      if (packageJsonExists) {
        const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
        
        if (!packageJson.version || packageJson.version === '1.0.0') {
          issues.push({
            type: 'breaking_changes',
            severity: 'medium',
            issue: 'no_version_management',
            message: 'Versionamento da API não está sendo gerenciado adequadamente',
            recommendation: 'Implementar versionamento semântico e documentar mudanças'
          });
        }
      }

    } catch (error) {
      issues.push({
        type: 'breaking_changes',
        severity: 'medium',
        issue: 'analysis_error',
        message: `Erro ao detectar breaking changes: ${error.message}`
      });
    }

    return issues;
  }

  calculateSummary(results) {
    const allIssues = [
      ...results.endpoints.issues,
      ...results.schemas.issues,
      ...results.documentation,
      ...results.validation,
      ...results.breakingChanges
    ];

    const severityCounts = {
      critical: 0,
      high: allIssues.filter(issue => issue.severity === 'high').length,
      medium: allIssues.filter(issue => issue.severity === 'medium').length,
      low: allIssues.filter(issue => issue.severity === 'low').length
    };

    const typeCounts = {
      endpoints: results.endpoints.issues.length,
      schemas: results.schemas.issues.length,
      documentation: results.documentation.length,
      validation: results.validation.length,
      breaking_changes: results.breakingChanges.length
    };

    return {
      totalIssues: allIssues.length,
      severityCounts,
      typeCounts,
      documentationScore: this.calculateDocumentationScore(severityCounts, results.coverage),
      coverage: results.coverage,
      qualityLevel: this.getQualityLevel(severityCounts, results.coverage)
    };
  }

  calculateDocumentationScore(severityCounts, coverage) {
    let score = 100;
    
    // Penaliza por issues
    score -= severityCounts.high * 15;
    score -= severityCounts.medium * 8;
    score -= severityCounts.low * 3;
    
    // Bonus por cobertura
    const coverageBonus = Math.round(coverage.overall * 0.2);
    score += coverageBonus;
    
    return Math.max(0, Math.min(100, score));
  }

  getQualityLevel(severityCounts, coverage) {
    if (severityCounts.high > 5 || coverage.overall < 30) {
      return 'Crítica';
    } else if (severityCounts.high > 2 || coverage.overall < 60) {
      return 'Baixa';
    } else if (severityCounts.medium > 5 || coverage.overall < 80) {
      return 'Média';
    } else {
      return 'Boa';
    }
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    // Recomendações baseadas em cobertura
    if (results.coverage.overall < 50) {
      recommendations.push({
        category: 'Cobertura',
        priority: 'critical',
        title: 'Melhorar cobertura de documentação',
        description: `Cobertura atual: ${results.coverage.overall}%. Meta: >80%`,
        actions: [
          'Documentar todos os endpoints com comentários @swagger',
          'Criar schemas para requests e responses',
          'Adicionar exemplos de uso da API'
        ]
      });
    }

    // Recomendações baseadas em endpoints
    const endpointIssues = results.endpoints.issues;
    const missingSwaggerDocs = endpointIssues.filter(i => i.issue === 'missing_swagger_doc');
    
    if (missingSwaggerDocs.length > 0) {
      recommendations.push({
        category: 'Endpoints',
        priority: 'high',
        title: 'Documentar endpoints',
        description: `${missingSwaggerDocs.length} endpoints sem documentação Swagger`,
        actions: [
          'Adicionar comentários @swagger em todos os endpoints',
          'Documentar parâmetros, responses e exemplos',
          'Configurar Swagger UI para visualização'
        ]
      });
    }

    // Recomendações baseadas em validação
    const validationIssues = results.validation;
    const missingValidation = endpointIssues.filter(i => i.issue === 'missing_validation');
    
    if (missingValidation.length > 0) {
      recommendations.push({
        category: 'Validação',
        priority: 'high',
        title: 'Implementar validação de parâmetros',
        description: `${missingValidation.length} endpoints sem validação`,
        actions: [
          'Instalar biblioteca de validação (Joi, Yup, express-validator)',
          'Implementar validação em todos os endpoints',
          'Documentar schemas de validação'
        ]
      });
    }

    // Recomendações baseadas em documentação geral
    const docIssues = results.documentation;
    const missingDocs = docIssues.filter(i => i.issue === 'missing_documentation_file');
    
    if (missingDocs.length > 0) {
      recommendations.push({
        category: 'Documentação',
        priority: 'medium',
        title: 'Criar documentação básica',
        description: 'Arquivos de documentação essenciais ausentes',
        actions: [
          'Criar README.md com instruções de uso',
          'Criar API.md com documentação detalhada',
          'Configurar estrutura de documentação organizada'
        ]
      });
    }

    return recommendations;
  }

  async generateSwaggerSpec(results) {
    try {
      const spec = swaggerJSDoc(this.swaggerOptions);
      
      if (!spec) {
        throw new Error('Falha ao gerar especificação Swagger');
      }
      
      // Salva especificação em JSON
      const jsonPath = path.join(this.docsDir, 'swagger.json');
      if (!fs.existsSync(this.docsDir)) {
        fs.mkdirSync(this.docsDir, { recursive: true });
      }
      
      fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2));
      
      // Salva especificação em YAML
      const yamlPath = path.join(this.docsDir, 'swagger.yaml');
      fs.writeFileSync(yamlPath, yaml.dump(spec));
      
      console.log(`📄 Especificação Swagger gerada: ${jsonPath}`);
      console.log(`📄 Especificação Swagger gerada: ${yamlPath}`);
      
    } catch (error) {
      console.error('Erro ao gerar especificação Swagger:', error.message);
    }
  }

  async saveReport(results) {
    try {
      const reportPath = path.join(this.projectRoot, 'api-documentation-analysis-report.json');
      
      const report = {
        timestamp: new Date().toISOString(),
        projectRoot: this.projectRoot,
        results,
        metadata: {
          analyzer: 'APIDocumentationGenerator',
          version: '1.0.0'
        }
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Relatório salvo: ${reportPath}`);

    } catch (error) {
      console.error('Erro ao salvar relatório:', error.message);
    }
  }
}

module.exports = APIDocumentationGenerator;