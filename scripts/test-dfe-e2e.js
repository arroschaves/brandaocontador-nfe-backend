const nfeService = require("../services/nfe-service");
const SefazClient = require("../services/sefaz-client");

async function run() {
  const chave = process.env.TEST_CHAVE_NFE || "";
  const simulateFailure = process.env.SIMULATE_FAILURE === "true";
  const simulateTimeoutMs = parseInt(process.env.SIMULATE_TIMEOUT_MS || "0");

  if (!chave) {
    console.error("TEST_CHAVE_NFE não definida");
    process.exit(1);
  }

  if (simulateFailure) {
    const original = SefazClient.prototype.distribuicaoDFe;
    SefazClient.prototype.distribuicaoDFe = async function () {
      if (simulateTimeoutMs > 0) {
        await new Promise((r) => setTimeout(r, simulateTimeoutMs));
      }
      throw new Error("Simulated network failure");
    };
    try {
      const xmlFail = await nfeService.obterXmlPorChave(chave);
      console.log("Deveria falhar, resultado:", !!xmlFail);
    } catch (e) {
      console.log("Falha simulada registrada:", e.message);
    }
    SefazClient.prototype.distribuicaoDFe = original;
  }

  const t0 = Date.now();
  let success = true;
  let error = "";
  try {
    const xml = await nfeService.obterXmlPorChave(chave);
    if (!xml) throw new Error("XML não encontrado");
    const pdf = await nfeService.downloadDocumento("pdf", chave);
    if (!pdf) throw new Error("PDF não gerado");
  } catch (e) {
    success = false;
    error = e.message;
  }
  const reportDir = require("path").join(process.cwd(), "reports");
  if (!require("fs").existsSync(reportDir)) require("fs").mkdirSync(reportDir, { recursive: true });
  require("fs").writeFileSync(require("path").join(reportDir, "e2e.json"), JSON.stringify({ success, error, duration: (Date.now() - t0) / 1000 }, null, 2));
  if (!success) process.exit(2);
}

run();
