const nfeService = require("../services/nfe-service");

async function run() {
  const chave = process.env.TEST_CHAVE_NFE || "";
  if (!chave) {
    console.error("Variável TEST_CHAVE_NFE não definida");
    process.exit(1);
  }
  try {
    const xml = await nfeService.obterXmlPorChave(chave);
    if (!xml) {
      console.error("XML não encontrado");
      process.exit(2);
    }
    const pdf = await nfeService.downloadDocumento("pdf", chave);
    console.log("DF-e OK, cache e geração DANFE ok", !!pdf);
    process.exit(0);
  } catch (e) {
    console.error("Falha no DF-e:", e.message);
    process.exit(3);
  }
}

run();
