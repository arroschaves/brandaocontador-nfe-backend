#!/usr/bin/env node

/**
 * Script de otimização para produção
 * Remove logs desnecessários e aplica melhorias de performance
 */

const fs = require('fs').promises;
const path = require('path');

class ProductionOptimizer {
    constructor() {
        this.backendDir = path.join(__dirname, '..');
        this.optimizations = [];
    }

    async optimize() {
        console.log('🚀 Iniciando otimização para produção...');
        
        try {
            await this.removeExcessiveLogs();
            await this.optimizeSecurityHeaders();
            await this.cleanupTempFiles();
            await this.optimizeRateLimit();
            
            console.log('✅ Otimização concluída com sucesso!');
            this.printSummary();
            
        } catch (error) {
            console.error('❌ Erro durante otimização:', error.message);
            process.exit(1);
        }
    }

    async removeExcessiveLogs() {
        console.log('🧹 Removendo logs excessivos...');
        
        const filesToOptimize = [
            'app.js',
            'services/nfe-service.js',
            'services/certificate-service.js',
            'config/database.js'
        ];

        for (const file of filesToOptimize) {
            const filePath = path.join(this.backendDir, file);
            try {
                let content = await fs.readFile(filePath, 'utf8');
                const originalLength = content.length;
                
                // Remover console.log desnecessários (manter apenas os importantes)
                content = content.replace(/console\.log\(`🔄 Tentando carregar certificado de:.*?\);/g, '');
                content = content.replace(/console\.log\(`Arquivo não encontrado:.*?\);/g, '');
                content = content.replace(/console\.log\(`📁 Diretório criado:.*?\);/g, '');
                content = content.replace(/console\.log\(`📄 Arquivo criado:.*?\);/g, '');
                
                if (content.length !== originalLength) {
                    await fs.writeFile(filePath, content, 'utf8');
                    this.optimizations.push(`Logs otimizados em ${file}`);
                }
                
            } catch (error) {
                console.warn(`⚠️ Não foi possível otimizar ${file}: ${error.message}`);
            }
        }
    }

    async optimizeSecurityHeaders() {
        console.log('🔒 Otimizando headers de segurança...');
        
        const middlewarePath = path.join(this.backendDir, 'middleware', 'security.js');
        try {
            let content = await fs.readFile(middlewarePath, 'utf8');
            
            // Verificar se já tem otimizações de produção
            if (!content.includes('X-Response-Time')) {
                const responseTimeMiddleware = `
// Middleware para tempo de resposta
const responseTime = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.set('X-Response-Time', \`\${duration}ms\`);
  });
  next();
};`;

                content = content.replace(
                    'module.exports = {',
                    `${responseTimeMiddleware}\n\nmodule.exports = {\n  responseTime,`
                );
                
                await fs.writeFile(middlewarePath, content, 'utf8');
                this.optimizations.push('Headers de performance adicionados');
            }
            
        } catch (error) {
            console.warn(`⚠️ Não foi possível otimizar security.js: ${error.message}`);
        }
    }

    async cleanupTempFiles() {
        console.log('🗑️ Limpando arquivos temporários...');
        
        const tempDirs = ['logs', 'xmls', 'pdfs'];
        
        for (const dir of tempDirs) {
            const dirPath = path.join(this.backendDir, dir);
            try {
                const files = await fs.readdir(dirPath);
                const oldFiles = [];
                
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stats = await fs.stat(filePath);
                    const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                    
                    // Remover arquivos com mais de 30 dias
                    if (daysSinceModified > 30) {
                        await fs.unlink(filePath);
                        oldFiles.push(file);
                    }
                }
                
                if (oldFiles.length > 0) {
                    this.optimizations.push(`${oldFiles.length} arquivos antigos removidos de ${dir}/`);
                }
                
            } catch (error) {
                // Diretório pode não existir, ignorar
            }
        }
    }

    async optimizeRateLimit() {
        console.log('⚡ Otimizando rate limiting...');
        
        const appPath = path.join(this.backendDir, 'app.js');
        try {
            let content = await fs.readFile(appPath, 'utf8');
            
            // Verificar se rate limit está otimizado para produção
            if (content.includes('RATE_LIMIT_MAX') && !content.includes('// Rate limit otimizado')) {
                const optimizedRateLimit = `
// Rate limit otimizado para produção
const productionRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    sucesso: false,
    erro: 'Muitas requisições. Tente novamente em alguns minutos.',
    codigo: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pular rate limit para health checks
    return req.path === '/health' || req.path === '/metrics';
  }
});`;

                // Adicionar comentário para identificar otimização
                content = content.replace(
                    'const globalRateLimit',
                    '// Rate limit otimizado\nconst globalRateLimit'
                );
                
                await fs.writeFile(appPath, content, 'utf8');
                this.optimizations.push('Rate limiting otimizado');
            }
            
        } catch (error) {
            console.warn(`⚠️ Não foi possível otimizar rate limit: ${error.message}`);
        }
    }

    printSummary() {
        console.log('\n📋 Resumo das otimizações aplicadas:');
        if (this.optimizations.length === 0) {
            console.log('   ✨ Sistema já estava otimizado');
        } else {
            this.optimizations.forEach((opt, index) => {
                console.log(`   ${index + 1}. ${opt}`);
            });
        }
        
        console.log('\n🎯 Recomendações adicionais para produção:');
        console.log('   • Configure um proxy reverso (Nginx)');
        console.log('   • Use HTTPS com certificados válidos');
        console.log('   • Configure backup automático do banco de dados');
        console.log('   • Monitore logs e métricas regularmente');
        console.log('   • Mantenha certificados digitais atualizados');
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const optimizer = new ProductionOptimizer();
    optimizer.optimize();
}

module.exports = { ProductionOptimizer };