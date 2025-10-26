#!/usr/bin/env node

const CodeQualityInspector = require('./index');
const path = require('path');
const fs = require('fs');

/**
 * CLI para Code Quality Inspector MCP
 */
class CodeQualityInspectorCLI {
  constructor() {
    this.inspector = null;
    this.options = {
      project: process.cwd(),
      output: null,
      format: 'json',
      maxComplexity: 10,
      maxFunctionLength: 50,
      maxFileLength: 500,
      verbose: false,
      showDetails: false
    };
  }

  /**
   * Processa argumentos da linha de comando
   */
  parseArgs(args) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--project':
        case '-p':
          this.options.project = args[++i];
          break;
        case '--output':
        case '-o':
          this.options.output = args[++i];
          break;
        case '--format':
        case '-f':
          this.options.format = args[++i];
          break;
        case '--max-complexity':
          this.options.maxComplexity = parseInt(args[++i]);
          break;
        case '--max-function-length':
          this.options.maxFunctionLength = parseInt(args[++i]);
          break;
        case '--max-file-length':
          this.options.maxFileLength = parseInt(args[++i]);
          break;
        case '--details':
        case '-d':
          this.options.showDetails = true;
          break;
        case '--verbose':
        case '-v':
          this.options.verbose = true;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
      }
    }
  }

  /**
   * Mostra ajuda
   */
  showHelp() {
    console.log(`
🔍 Code Quality Inspector MCP - Análise de Qualidade de Código

USAGE:
  node cli.js [options]

OPTIONS:
  -p, --project <path>           Caminho do projeto (padrão: diretório atual)
  -o, --output <file>            Arquivo de saída do relatório
  -f, --format <format>          Formato do relatório (json, html, txt)
  --max-complexity <num>         Complexidade máxima permitida (padrão: 10)
  --max-function-length <num>    Tamanho máximo de função (padrão: 50)
  --max-file-length <num>        Tamanho máximo de arquivo (padrão: 500)
  -d, --details                  Mostra detalhes dos code smells
  -v, --verbose                  Saída detalhada
  -h, --help                     Mostra esta ajuda

EXAMPLES:
  node cli.js --project /path/to/project
  node cli.js --max-complexity 15 --details
  node cli.js --output quality-report.json --format json
  node cli.js --verbose --max-file-length 300
    `);
  }

  /**
   * Executa análise de qualidade
   */
  async run(args) {
    this.parseArgs(args);
    
    if (this.options.verbose) {
      console.log('🔍 Iniciando Code Quality Inspector MCP');
      console.log(`📁 Projeto: ${this.options.project}`);
      console.log(`📊 Complexidade máxima: ${this.options.maxComplexity}`);
      console.log(`📏 Tamanho máximo de função: ${this.options.maxFunctionLength}`);
      console.log(`📄 Tamanho máximo de arquivo: ${this.options.maxFileLength}`);
    }
    
    try {
      // Verifica se o projeto existe
      if (!fs.existsSync(this.options.project)) {
        console.error(`❌ Projeto não encontrado: ${this.options.project}`);
        process.exit(1);
      }
      
      // Inicializa inspector
      this.inspector = new CodeQualityInspector({
        projectRoot: this.options.project,
        maxComplexity: this.options.maxComplexity,
        maxFunctionLength: this.options.maxFunctionLength,
        maxFileLength: this.options.maxFileLength
      });
      
      // Executa análise
      const report = await this.inspector.analyze();
      
      // Exibe resumo
      this.displaySummary(report);
      
      // Exibe detalhes se solicitado
      if (this.options.showDetails) {
        this.displayDetails(report);
      }
      
      // Salva relatório se especificado
      if (this.options.output) {
        await this.saveReport(report);
      }
      
      // Exibe recomendações
      this.displayRecommendations(report);
      
      // Define código de saída baseado na qualidade
      const exitCode = this.getExitCode(report);
      process.exit(exitCode);
      
    } catch (error) {
      console.error('❌ Erro durante análise:', error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Exibe resumo do relatório
   */
  displaySummary(report) {
    console.log('\n📊 RESUMO DA ANÁLISE DE QUALIDADE');
    console.log('==================================');
    
    console.log(`📁 Arquivos analisados: ${report.summary.totalFiles}`);
    console.log(`📄 Linhas de código: ${report.summary.totalLines.toLocaleString()}`);
    console.log(`🔧 Funções encontradas: ${report.summary.totalFunctions}`);
    console.log(`⚠️  Code smells: ${report.summary.totalCodeSmells}`);
    
    // Nota de qualidade
    const grade = report.qualityGrade;
    const gradeEmoji = this.getGradeEmoji(grade.grade);
    console.log(`\n${gradeEmoji} NOTA DE QUALIDADE: ${grade.grade} (${grade.description})`);
    console.log(`📈 Índice de Manutenibilidade: ${report.summary.maintainabilityIndex.toFixed(1)}/100`);
    console.log(`🔄 Complexidade Média: ${report.summary.averageComplexity.toFixed(1)}`);
    console.log(`⏱️  Dívida Técnica: ${report.summary.technicalDebtHours}h`);
    
    // Distribuição de problemas
    console.log('\n🚨 DISTRIBUIÇÃO DE PROBLEMAS:');
    console.log(`  🔴 Críticos: ${report.summary.criticalIssues}`);
    console.log(`  🟡 Altos: ${report.summary.highIssues}`);
    console.log(`  🟢 Médios: ${report.summary.mediumIssues}`);
    
    // Tempo de análise
    if (report.analysisTime) {
      console.log(`\n⏱️  Tempo de análise: ${(report.analysisTime / 1000).toFixed(2)}s`);
    }
  }

  /**
   * Retorna emoji para nota
   */
  getGradeEmoji(grade) {
    switch (grade) {
      case 'A': return '🏆';
      case 'B': return '👍';
      case 'C': return '⚠️';
      case 'D': return '❌';
      case 'F': return '💥';
      default: return '❓';
    }
  }

  /**
   * Exibe detalhes dos code smells
   */
  displayDetails(report) {
    console.log('\n🔍 DETALHES DOS CODE SMELLS');
    console.log('===========================');
    
    // Funções com alta complexidade
    if (report.codeSmells.highComplexity.length > 0) {
      console.log('\n🔴 ALTA COMPLEXIDADE:');
      report.codeSmells.highComplexity.forEach(smell => {
        console.log(`  📁 ${path.relative(this.options.project, smell.file)}`);
        console.log(`     🔧 ${smell.function} (complexidade: ${smell.complexity})`);
      });
    }
    
    // Funções longas
    if (report.codeSmells.longFunction.length > 0) {
      console.log('\n📏 FUNÇÕES LONGAS:');
      report.codeSmells.longFunction.forEach(smell => {
        console.log(`  📁 ${path.relative(this.options.project, smell.file)}`);
        console.log(`     🔧 ${smell.function} (${smell.lines} linhas)`);
      });
    }
    
    // Arquivos longos
    if (report.codeSmells.longFile.length > 0) {
      console.log('\n📄 ARQUIVOS LONGOS:');
      report.codeSmells.longFile.forEach(smell => {
        console.log(`  📁 ${path.relative(this.options.project, smell.file)} (${smell.lines} linhas)`);
      });
    }
    
    // Código duplicado
    if (report.codeSmells.duplicateCode.length > 0) {
      console.log('\n🔄 CÓDIGO DUPLICADO:');
      report.codeSmells.duplicateCode.forEach(smell => {
        console.log(`  📁 ${path.relative(this.options.project, smell.file1)}`);
        console.log(`  📁 ${path.relative(this.options.project, smell.file2)}`);
        console.log(`     📝 ${smell.lines} linhas duplicadas`);
      });
    }
    
    // Muitos parâmetros
    if (report.codeSmells.tooManyParameters.length > 0) {
      console.log('\n📋 MUITOS PARÂMETROS:');
      report.codeSmells.tooManyParameters.forEach(smell => {
        console.log(`  📁 ${path.relative(this.options.project, smell.file)}`);
        console.log(`     🔧 ${smell.function} (${smell.parameters} parâmetros)`);
      });
    }
    
    // Aninhamento profundo
    if (report.codeSmells.deepNesting.length > 0) {
      console.log('\n🏗️  ANINHAMENTO PROFUNDO:');
      report.codeSmells.deepNesting.forEach(smell => {
        console.log(`  📁 ${path.relative(this.options.project, smell.file)}`);
        console.log(`     🔧 ${smell.function} (${smell.nestingLevel} níveis)`);
      });
    }
  }

  /**
   * Salva relatório
   */
  async saveReport(report) {
    const outputPath = this.options.output;
    
    switch (this.options.format.toLowerCase()) {
      case 'json':
        await this.inspector.saveReport(report, outputPath);
        break;
      case 'html':
        await this.saveHtmlReport(report, outputPath);
        break;
      case 'txt':
        await this.saveTextReport(report, outputPath);
        break;
      default:
        console.warn(`⚠️ Formato não suportado: ${this.options.format}. Usando JSON.`);
        await this.inspector.saveReport(report, outputPath);
    }
  }

  /**
   * Salva relatório em HTML
   */
  async saveHtmlReport(report, outputPath) {
    const html = this.generateHtmlReport(report);
    fs.writeFileSync(outputPath, html);
    console.log(`📊 Relatório HTML salvo em: ${outputPath}`);
  }

  /**
   * Gera relatório HTML
   */
  generateHtmlReport(report) {
    const grade = report.qualityGrade;
    const gradeColor = this.getGradeColor(grade.grade);
    
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Qualidade de Código</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .grade { font-size: 2em; color: ${gradeColor}; font-weight: bold; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 4px; }
        .smell-section { margin: 20px 0; }
        .smell-item { margin: 5px 0; padding: 5px; background: #f9f9f9; border-left: 4px solid #ccc; }
        .high { border-left-color: #ff4444; }
        .medium { border-left-color: #ffaa00; }
        .low { border-left-color: #44ff44; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Relatório de Qualidade de Código</h1>
        <div class="grade">Nota: ${grade.grade} (${grade.description})</div>
        <p>Gerado em: ${report.timestamp}</p>
    </div>
    
    <h2>Resumo</h2>
    <div class="metric">Arquivos: ${report.summary.totalFiles}</div>
    <div class="metric">Linhas: ${report.summary.totalLines.toLocaleString()}</div>
    <div class="metric">Funções: ${report.summary.totalFunctions}</div>
    <div class="metric">Code Smells: ${report.summary.totalCodeSmells}</div>
    <div class="metric">Complexidade Média: ${report.summary.averageComplexity.toFixed(1)}</div>
    <div class="metric">Dívida Técnica: ${report.summary.technicalDebtHours}h</div>
    
    <h2>Principais Problemas</h2>
    ${report.topIssues.map(issue => `
        <div class="smell-item ${issue.severity}">
            <strong>${issue.type}</strong>: ${issue.message}<br>
            <small>Arquivo: ${issue.file} | Severidade: ${issue.severity}</small>
        </div>
    `).join('')}
    
    <h2>Recomendações</h2>
    ${report.recommendations.map(rec => `
        <div class="smell-item ${rec.priority}">
            <strong>${rec.action}</strong><br>
            <small>${rec.details} | Esforço: ${rec.effort}</small>
        </div>
    `).join('')}
</body>
</html>`;
  }

  /**
   * Retorna cor para nota
   */
  getGradeColor(grade) {
    switch (grade) {
      case 'A': return '#00aa00';
      case 'B': return '#88aa00';
      case 'C': return '#aaaa00';
      case 'D': return '#aa4400';
      case 'F': return '#aa0000';
      default: return '#666666';
    }
  }

  /**
   * Salva relatório em texto
   */
  async saveTextReport(report, outputPath) {
    const text = this.generateTextReport(report);
    fs.writeFileSync(outputPath, text);
    console.log(`📊 Relatório de texto salvo em: ${outputPath}`);
  }

  /**
   * Gera relatório em texto
   */
  generateTextReport(report) {
    let text = 'RELATÓRIO DE QUALIDADE DE CÓDIGO\n';
    text += '================================\n\n';
    
    text += `Gerado em: ${report.timestamp}\n`;
    text += `Nota: ${report.qualityGrade.grade} (${report.qualityGrade.description})\n\n`;
    
    text += 'RESUMO:\n';
    text += `- Arquivos: ${report.summary.totalFiles}\n`;
    text += `- Linhas: ${report.summary.totalLines.toLocaleString()}\n`;
    text += `- Funções: ${report.summary.totalFunctions}\n`;
    text += `- Code Smells: ${report.summary.totalCodeSmells}\n`;
    text += `- Complexidade Média: ${report.summary.averageComplexity.toFixed(1)}\n`;
    text += `- Dívida Técnica: ${report.summary.technicalDebtHours}h\n\n`;
    
    text += 'PRINCIPAIS PROBLEMAS:\n';
    report.topIssues.forEach(issue => {
      text += `- ${issue.type}: ${issue.message}\n`;
      text += `  Arquivo: ${issue.file}\n`;
      text += `  Severidade: ${issue.severity}\n\n`;
    });
    
    text += 'RECOMENDAÇÕES:\n';
    report.recommendations.forEach(rec => {
      text += `- ${rec.action}\n`;
      text += `  ${rec.details}\n`;
      text += `  Esforço: ${rec.effort}\n\n`;
    });
    
    return text;
  }

  /**
   * Exibe recomendações
   */
  displayRecommendations(report) {
    if (report.recommendations.length === 0) {
      console.log('\n✅ Nenhuma recomendação de qualidade encontrada!');
      return;
    }
    
    console.log('\n💡 RECOMENDAÇÕES');
    console.log('================');
    
    const high = report.recommendations.filter(r => r.priority === 'high');
    const medium = report.recommendations.filter(r => r.priority === 'medium');
    const low = report.recommendations.filter(r => r.priority === 'low');
    
    if (high.length > 0) {
      console.log('\n🔴 ALTA PRIORIDADE:');
      high.forEach(rec => {
        console.log(`  • ${rec.action}`);
        console.log(`    ${rec.details}`);
        console.log(`    Esforço: ${rec.effort}`);
      });
    }
    
    if (medium.length > 0) {
      console.log('\n🟡 MÉDIA PRIORIDADE:');
      medium.forEach(rec => {
        console.log(`  • ${rec.action}`);
        console.log(`    ${rec.details}`);
        console.log(`    Esforço: ${rec.effort}`);
      });
    }
    
    if (low.length > 0 && this.options.verbose) {
      console.log('\n🟢 BAIXA PRIORIDADE:');
      low.forEach(rec => {
        console.log(`  • ${rec.action}`);
        console.log(`    ${rec.details}`);
        console.log(`    Esforço: ${rec.effort}`);
      });
    }
  }

  /**
   * Determina código de saída baseado na qualidade
   */
  getExitCode(report) {
    if (report.summary.criticalIssues > 0) {
      return 2; // Problemas críticos
    }
    
    if (report.summary.highIssues > 5) {
      return 1; // Muitos problemas de alta severidade
    }
    
    if (report.qualityGrade.grade === 'F') {
      return 1; // Nota muito baixa
    }
    
    return 0; // Sucesso
  }
}

// Executa CLI se chamado diretamente
if (require.main === module) {
  const cli = new CodeQualityInspectorCLI();
  cli.run(process.argv.slice(2));
}

module.exports = CodeQualityInspectorCLI;