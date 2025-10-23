// Extract text from Observations.pdf and save as Markdown
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function main() {
  try {
    const repoRoot = path.join(__dirname, '..', '..');
    const pdfPath = path.join(repoRoot, 'Observations.pdf');
    const outPath = path.join(repoRoot, 'Observations.extracted.md');

    if (!fs.existsSync(pdfPath)) {
      console.error('Arquivo não encontrado:', pdfPath);
      process.exit(1);
    }
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);

    const header = '# Observations.pdf - Texto Extraído\n\n';
    const body = (data.text || '').replace(/\r\n/g, '\n');
    const content = header + body;

    fs.writeFileSync(outPath, content, 'utf8');
    console.log('Extração concluída. Arquivo gerado em:', outPath);
    console.log('Resumo: páginas =', data.numpages, ', info =', JSON.stringify(data.info || {}));
  } catch (err) {
    console.error('Falha ao extrair PDF:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();