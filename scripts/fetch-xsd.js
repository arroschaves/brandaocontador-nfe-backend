const fs = require("fs");
const path = require("path");
const axios = require("axios");

const MAP = {
  producao: {
    enviNFe_v4_00: "https://www.nfe.fazenda.gov.br/portal/exemplo/enviNFe_v4.00.xsd",
    consSitNFe_v4_00: "https://www.nfe.fazenda.gov.br/portal/exemplo/consSitNFe_v4.00.xsd",
    eventoCancNFe_v1_00: "https://www.nfe.fazenda.gov.br/portal/exemplo/eventoCancNFe_v1.00.xsd",
    inutNFe_v4_00: "https://www.nfe.fazenda.gov.br/portal/exemplo/inutNFe_v4.00.xsd",
    distDFe_v1_01: "https://www.nfe.fazenda.gov.br/portal/exemplo/distDFe_v1.01.xsd"
  },
  homologacao: {
    enviNFe_v4_00: "https://www.nfe.fazenda.gov.br/portal/exemplo/enviNFe_v4.00.xsd",
    consSitNFe_v4_00: "https://www.nfe.fazenda.gov.br/portal/exemplo/consSitNFe_v4.00.xsd",
    eventoCancNFe_v1_00: "https://www.nfe.fazenda.gov.br/portal/exemplo/eventoCancNFe_v1.00.xsd",
    inutNFe_v4_00: "https://www.nfe.fazenda.gov.br/portal/exemplo/inutNFe_v4.00.xsd",
    distDFe_v1_01: "https://www.nfe.fazenda.gov.br/portal/exemplo/distDFe_v1.01.xsd"
  }
};

async function download(url, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const res = await axios.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(dest, res.data);
}

async function main() {
  for (const env of Object.keys(MAP)) {
    const envMap = MAP[env];
    for (const key of Object.keys(envMap)) {
      const url = envMap[key];
      const name = key.replace(/_/g, ".").replace("v", "v").replace("4_00", "4.00").replace("1_00", "1.00").replace("1_01", "1.01");
      const dest = path.join(process.cwd(), "xsd", env, `${name}.xsd`);
      try {
        await download(url, dest);
        console.log("Baixado:", dest);
      } catch (e) {
        console.log("Falha ao baixar", url, e.message);
      }
    }
  }
  // Atualiza checksums
  require("child_process").execSync("node scripts/generate-xsd-checksums.js", { stdio: "inherit" });
}

main();
