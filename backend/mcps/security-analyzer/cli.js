#!/usr/bin/env node

const SecurityAnalyzer = require('./index');
const path = require('path');
const fs = require('fs');

/**
 * CLI para executar o Security Analyzer
 */
class SecurityAnalyzerCLI {
  constructor() {
    this.args = process.argv.slice(2);
    this.options = this.parseArgs();
  }

  parseArgs() {
    const options = {
      projectRoot: process.cwd(),
      output: null,
      format: 'json',
      verbose: false,
      help: false
    };

    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i];
      
      switch (arg) {
        case '--project':
        case '-p':
          options.projectRoot = this.args[++i];
          break;
        case '--output':
        case '-o':
          options.output = this.args[++i];
          break;
        case '--format':
        case '-f':
          options.format = this.args[++i];
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--help':
        case '-h':
          options.help = true;
          break;
        default:
          if (arg.startsWith('-')) {
            console.error(`❌ Opção desconhecida: ${arg}`);
            process.exit(1);
          }
          break;
      }
    }

    return options;
  }

  showHelp() {
    console.log(`
🔍 Security Analyzer MCP - Análise de Segurança

USAGE:
  node cli.js [options]

OPTIONS:
  -p, --project <path>    Caminho do projeto a ser analisado (padrão: diretório atual)
  -o, --output <file>     Arquivo de saída para o relatório
  -f, --format <format>   Formato do relatório (json, html, txt) (padrão: json)
  -v, --verbose           Modo verboso
  -h, --help              Mostra esta ajuda

EXAMPLES:
  node cli.js                                    # Analisa projeto atual
  node cli.js -p /path/to/project               # Analisa projeto específico
  node cli.js -o security-report.json          # Salva relatório em arquivo
  node cli.js -f html -o report.html           # Gera relatório HTML
  node cli.js -v                               # Modo verboso

SECURITY CHECKS:
  ✓ Vulnerabilidades em dependências (npm audit)
  ✓ Secrets expostos no código
  ✓ Configurações de headers HTTP
  ✓ Configurações de segurança gerais
  ✓ Análise de arquivos .env e .gitignore
    `);
  }

  async run() {
    if (this.options.help) {
      this.showHelp();
      return;
    }

    console.log('🔍 Security Analyzer MCP v1.0.0');
    console.log('=====================================\n');

    if (this.options.verbose) {
      console.log('📋 Configurações:');
      console.log(`   Projeto: ${this.options.projectRoot}`);
      console.log(`   Formato: ${this.options.format}`);
      console.log(`   Saída: ${this.options.output || 'console'}`);
      console.log('');
    }

    try {
      // Verificar se o diretório do projeto existe
      if (!fs.existsSync(this.options.projectRoot)) {
        console.error(`❌ Diretório não encontrado: ${this.options.projectRoot}`);
        process.exit(1);
      }

      // Inicializar analyzer
      const analyzer = new SecurityAnalyzer({
        projectRoot: this.options.projectRoot
      });

      // Executar análise
      const results = await analyzer.analyze();

      // Exibir resultados
      this.displayResults(results);

      // Salvar relatório se especificado
      if (this.options.output) {
        await this.saveReport(results, analyzer);
      }

      // Definir código de saída baseado na severidade dos problemas
      const exitCode = this.getExitCode(results);
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Erro durante a análise:', error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  displayResults(results) {
    console.log('\n📊 RESUMO DA ANÁLISE');
    console.log('====================');
    console.log(`Total de problemas: ${results.summary.totalIssues}`);
    console.log(`🔴 Críticos: ${results.summary.criticalIssues}`);
    console.log(`🟠 Altos: ${results.summary.highIssues}`);
    console.log(`🟡 Médios: ${results.summary.mediumIssues}`);
    console.log(`🟢 Baixos: ${results.summary.lowIssues}`);

    if (results.vulnerabilities.length > 0) {
      console.log('\n🚨 VULNERABILIDADES EM DEPENDÊNCIAS');
      console.log('====================================');
      results.vulnerabilities.forEach((vuln, index) => {
        const icon = this.getSeverityIcon(vuln.severity);
        console.log(`${index + 1}. ${icon} ${vuln.package}`);
        console.log(`   Severidade: ${vuln.severity}`);
        console.log(`   Descrição: ${vuln.description}`);
        console.log(`   Recomendação: ${vuln.recommendation}`);
        console.log('');
      });
    }

    if (results.secrets.length > 0) {
      console.log('\n🔐 SECRETS EXPOSTOS');
      console.log('===================');
      results.secrets.forEach((secret, index) => {
        console.log(`${index + 1}. 🔴 ${secret.file}:${secret.line}`);
        console.log(`   Conteúdo: ${secret.content}`);
        console.log(`   Recomendação: ${secret.recommendation}`);
        console.log('');
      });
    }

    if (results.headers.length > 0) {
      console.log('\n🌐 PROBLEMAS DE HEADERS HTTP');
      console.log('============================');
      results.headers.forEach((header, index) => {
        const icon = this.getSeverityIcon(header.severity);
        console.log(`${index + 1}. ${icon} ${header.issue}`);
        console.log(`   Descrição: ${header.description}`);
        console.log(`   Recomendação: ${header.recommendation}`);
        console.log('');
      });
    }

    if (results.configurations.length > 0) {
      console.log('\n⚙️ PROBLEMAS DE CONFIGURAÇÃO');
      console.log('============================');
      results.configurations.forEach((config, index) => {
        const icon = this.getSeverityIcon(config.severity);
        console.log(`${index + 1}. ${icon} ${config.issue}`);
        console.log(`   Arquivo: ${config.file}`);
        console.log(`   Descrição: ${config.description}`);
        console.log(`   Recomendação: ${config.recommendation}`);
        console.log('');
      });
    }

    if (results.recommendations.length > 0) {
      console.log('\n💡 RECOMENDAÇÕES PRIORITÁRIAS');
      console.log('=============================');
      results.recommendations.forEach((rec, index) => {
        const icon = this.getPriorityIcon(rec.priority);
        console.log(`${index + 1}. ${icon} ${rec.action}`);
        console.log(`   ${rec.description}`);
        console.log('');
      });
    }

    if (results.summary.totalIssues === 0) {
      console.log('\n✅ PARABÉNS! Nenhum problema de segurança encontrado.');
    }
  }

  getSeverityIcon(severity) {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  getPriorityIcon(priority) {
    switch (priority) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '📋';
      case 'low': return 'ℹ️';
      default: return '📝';
    }
  }

  async saveReport(results, analyzer) {
    const outputPath = path.resolve(this.options.output);
    
    switch (this.options.format) {
      case 'json':
        await analyzer.saveReport(results, outputPath);
        break;
      case 'html':
        await this.saveHtmlReport(results, outputPath);
        break;
      case 'txt':
        await this.saveTxtReport(results, outputPath);
        break;
      default:
        console.error(`❌ Formato não suportado: ${this.options.format}`);
        process.exit(1);
    }
  }

  async saveHtmlReport(results, outputPath) {
    const html = this.generateHtmlReport(results);
    fs.writeFileSync(outputPath, html);
    console.log(`📄 Relatório HTML salvo em: ${outputPath}`);
  }

  async saveTxtReport(results, outputPath) {
    let report = 'RELATÓRIO DE SEGURANÇA\n';
    report += '=====================\n\n';
    report += `Gerado em: ${results.timestamp}\n`;
    report += `Total de problemas: ${results.summary.totalIssues}\n`;
    report += `Críticos: ${results.summary.criticalIssues}\n`;
    report += `Altos: ${results.summary.highIssues}\n`;
    report += `Médios: ${results.summary.mediumIssues}\n`;
    report += `Baixos: ${results.summary.lowIssues}\n\n`;

    if (results.vulnerabilities.length > 0) {
      report += 'VULNERABILIDADES EM DEPENDÊNCIAS\n';
      report += '=================================\n';
      results.vulnerabilities.forEach((vuln, index) => {
        report += `${index + 1}. ${vuln.package} (${vuln.severity})\n`;
        report += `   ${vuln.description}\n`;
        report += `   Recomendação: ${vuln.recommendation}\n\n`;
      });
    }

    // Adicionar outras seções...

    fs.writeFileSync(outputPath, report);
    console.log(`📄 Relatório TXT salvo em: ${outputPath}`);
  }

  generateHtmlReport(results) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Segurança</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .critical { color: #dc3545; }
        .high { color: #fd7e14; }
        .medium { color: #ffc107; }
        .low { color: #28a745; }
        .section { margin: 30px 0; }
        .issue { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .issue-title { font-weight: bold; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Relatório de Segurança</h1>
        <p>Gerado em: ${results.timestamp}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total</h3>
            <div style="font-size: 2em;">${results.summary.totalIssues}</div>
        </div>
        <div class="metric critical">
            <h3>Críticos</h3>
            <div style="font-size: 2em;">${results.summary.criticalIssues}</div>
        </div>
        <div class="metric high">
            <h3>Altos</h3>
            <div style="font-size: 2em;">${results.summary.highIssues}</div>
        </div>
        <div class="metric medium">
            <h3>Médios</h3>
            <div style="font-size: 2em;">${results.summary.mediumIssues}</div>
        </div>
        <div class="metric low">
            <h3>Baixos</h3>
            <div style="font-size: 2em;">${results.summary.lowIssues}</div>
        </div>
    </div>

    ${results.vulnerabilities.length > 0 ? `
    <div class="section">
        <h2>🚨 Vulnerabilidades em Dependências</h2>
        ${results.vulnerabilities.map(vuln => `
        <div class="issue">
            <div class="issue-title ${vuln.severity}">${vuln.package} (${vuln.severity})</div>
            <p><strong>Descrição:</strong> ${vuln.description}</p>
            <p><strong>Recomendação:</strong> ${vuln.recommendation}</p>
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${results.secrets.length > 0 ? `
    <div class="section">
        <h2>🔐 Secrets Expostos</h2>
        ${results.secrets.map(secret => `
        <div class="issue">
            <div class="issue-title critical">${secret.file}:${secret.line}</div>
            <p><strong>Conteúdo:</strong> ${secret.content}</p>
            <p><strong>Recomendação:</strong> ${secret.recommendation}</p>
        </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>💡 Recomendações</h2>
        ${results.recommendations.map(rec => `
        <div class="issue">
            <div class="issue-title">${rec.action}</div>
            <p>${rec.description}</p>
        </div>
        `).join('')}
    </div>
</body>
</html>
    `;
  }

  getExitCode(results) {
    if (results.summary.criticalIssues > 0) return 2;
    if (results.summary.highIssues > 0) return 1;
    return 0;
  }
}

// Executar CLI se chamado diretamente
if (require.main === module) {
  const cli = new SecurityAnalyzerCLI();
  cli.run().catch(error => {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  });
}

module.exports = SecurityAnalyzerCLI;