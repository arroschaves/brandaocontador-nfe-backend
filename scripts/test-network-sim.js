const SefazClient = require("../services/sefaz-client");
const nfeService = require("../services/nfe-service");

async function run() {
  const chave = process.env.TEST_CHAVE_NFE || "";
  const rounds = parseInt(process.env.TEST_ROUNDS || "20");
  const loss = parseFloat(process.env.TEST_PACKET_LOSS || "0.1");
  const latency = parseInt(process.env.TEST_LATENCY_MS || "200");
  const original = SefazClient.prototype.distribuicaoDFe;

  SefazClient.prototype.distribuicaoDFe = async function (...args) {
    await new Promise((r) => setTimeout(r, latency));
    if (Math.random() < loss) throw new Error("Simulated packet loss");
    return original.apply(this, args);
  };

  let ok = 0, fail = 0;
  const t0 = Date.now();
  for (let i = 0; i < rounds; i++) {
    try {
      if (chave) await nfeService.obterXmlPorChave(chave);
      ok++;
    } catch { fail++; }
  }
  const dur = (Date.now() - t0) / 1000;
  const reportDir = require("path").join(process.cwd(), "reports");
  if (!require("fs").existsSync(reportDir)) require("fs").mkdirSync(reportDir, { recursive: true });
  require("fs").writeFileSync(require("path").join(reportDir, "network.json"), JSON.stringify({ ok, fail, duration_sec: dur }, null, 2));
  SefazClient.prototype.distribuicaoDFe = original;
}

run();
