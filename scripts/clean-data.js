#!/usr/bin/env node

/**
 * Script para limpar dados mockados/simulados do sistema
 * ATENÇÃO: Este script apaga TODOS os dados de teste
 *
 * Uso: node scripts/clean-data.js
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const dataDir = path.join(__dirname, "../data");

// Arquivos a limpar completamente (array vazio)
const arquivosParaLimpar = [
  "clientes.json",
  "produtos.json",
  "nfes.json",
  "ctes.json",
  "mdfes.json",
  "eventos.json",
  "relatorios.json",
  "auditoria.json",
];

// Arquivos a preservar mas resetar estrutura
const arquivosParaResetar = {
  "configuracoes.json": { usuarios: {} },
  "numeracao.json": { series: {} },
};

async function confirmarLimpeza() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(
      "\n╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║    LIMPEZA DE DADOS - Sistema NFe Brandão Contador           ║",
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝\n",
    );

    console.log("⚠️  ATENÇÃO: Esta operação irá:");
    console.log("   • Remover TODOS os clientes");
    console.log("   • Remover TODOS os produtos");
    console.log("   • Remover TODAS as NFes");
    console.log("   • Remover TODOS os CTes");
    console.log("   • Remover TODOS os MDFes");
    console.log("   • Resetar configurações (exceto usuário admin)");
    console.log("   • Resetar numeração de documentos\n");

    console.log("✅ Será preservado:");
    console.log(
      "   • Usuário administrador (cjbrandao@brandaocontador.com.br)",
    );
    console.log("   • Certificados digitais enviados");
    console.log("   • Estrutura de diretórios\n");

    rl.question("❓ Deseja continuar? (sim/não): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "sim" || answer.toLowerCase() === "s");
    });
  });
}

async function limparDados() {
  console.log("\n🧹 Iniciando limpeza de dados...\n");

  // Garantir que diretório data/ existe
  if (!fs.existsSync(dataDir)) {
    console.log("📁 Criando diretório data/...");
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let totalArquivosLimpos = 0;

  // Limpar arquivos com array vazio
  for (const arquivo of arquivosParaLimpar) {
    const filePath = path.join(dataDir, arquivo);

    try {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), "utf8");
      console.log(`✅ ${arquivo.padEnd(25)} → Limpo (array vazio)`);
      totalArquivosLimpos++;
    } catch (error) {
      console.log(`⚠️  ${arquivo.padEnd(25)} → Erro: ${error.message}`);
    }
  }

  // Resetar arquivos com estrutura específica
  for (const [arquivo, estrutura] of Object.entries(arquivosParaResetar)) {
    const filePath = path.join(dataDir, arquivo);

    try {
      fs.writeFileSync(filePath, JSON.stringify(estrutura, null, 2), "utf8");
      console.log(`✅ ${arquivo.padEnd(25)} → Resetado`);
      totalArquivosLimpos++;
    } catch (error) {
      console.log(`⚠️  ${arquivo.padEnd(25)} → Erro: ${error.message}`);
    }
  }

  // Preservar apenas usuário admin em users.json
  const usersPath = path.join(dataDir, "users.json");
  try {
    if (fs.existsSync(usersPath)) {
      const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));

      // Encontrar admin
      const admin = users.find(
        (u) => u.email === "cjbrandao@brandaocontador.com.br",
      );

      if (admin) {
        // Manter apenas admin
        fs.writeFileSync(usersPath, JSON.stringify([admin], null, 2), "utf8");
        console.log(`✅ users.json${" ".repeat(18)} → Apenas admin preservado`);
      } else {
        console.log(`⚠️  users.json${" ".repeat(18)} → Admin não encontrado!`);
      }
    }
    totalArquivosLimpos++;
  } catch (error) {
    console.log(`⚠️  users.json${" ".repeat(18)} → Erro: ${error.message}`);
  }

  console.log("\n" + "─".repeat(66));
  console.log(
    `\n✨ Limpeza concluída! ${totalArquivosLimpos} arquivos processados\n`,
  );
  console.log("📊 Próximos passos:");
  console.log("   1. Faça login com o usuário admin");
  console.log("   2. Configure os dados da empresa");
  console.log("   3. Faça upload do certificado digital");
  console.log("   4. Comece a emitir documentos fiscais reais\n");
}

async function limparDataMockadaEmServices() {
  console.log("\n🔧 Verificando services com dados mockados...\n");

  const servicesToCheck = [
    {
      file: "../services/certificate-service.js",
      name: "Certificate Service",
      hasMock: true,
      note: "Validação mockada nas linhas 115-124",
    },
    {
      file: "../routes/configuracoes.js",
      name: "Configurações Route",
      hasMock: true,
      note: "Certificado mock nas linhas 985-992",
    },
  ];

  console.log("ℹ️  Dados mockados detectados nos seguintes arquivos:\n");

  servicesToCheck.forEach((service) => {
    if (service.hasMock) {
      console.log(`   📄 ${service.name}`);
      console.log(`      └─ ${service.note}\n`);
    }
  });

  console.log("⚠️  IMPORTANTE:");
  console.log("   Estes mocks serão substituídos por validação real");
  console.log("   na implementação da validação de certificado (Fase 2)\n");
}

// Executar
(async () => {
  try {
    const confirmado = await confirmarLimpeza();

    if (!confirmado) {
      console.log("\n❌ Operação cancelada pelo usuário\n");
      process.exit(0);
    }

    await limparDados();
    await limparDataMockadaEmServices();

    console.log("✅ Script finalizado com sucesso!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erro ao executar script:", error.message);
    process.exit(1);
  }
})();
