#!/usr/bin/env node
const fs = require('fs');
const targetPath = process.argv[2];
if (!targetPath) {
  console.error('Uso: node rewrite404.js <caminho do arquivo>');
  process.exit(1);
}
let src = fs.readFileSync(targetPath, 'utf8');
let changed = false;

// Localiza e substitui o bloco 404 precoce (app.use('*', (req, res) => { ... });) por pass-through
const comment = '// Middleware para rotas não encontradas';
const commentIdx = src.indexOf(comment);
if (commentIdx !== -1) {
  const useIdx = src.indexOf("app.use('*', (req, res", commentIdx);
  if (useIdx !== -1) {
    const rel = src.slice(useIdx);
    const lineMatch = rel.match(/^[\t ]*\}\);[\t ]*$/m);
    if (lineMatch && typeof lineMatch.index === 'number') {
      const endLineStart = useIdx + lineMatch.index;
      const eol = src.indexOf('\n', endLineStart);
      const endAfter = eol === -1 ? src.length : eol + 1;
      const before = src.slice(0, useIdx);
      const after = src.slice(endAfter);
      src = `${before}app.use('*', (req, res, next) => next());\n${after}`;
      changed = true;
    }
  }
}

// Garante 404 final, caso não exista
if (!src.includes('Middleware 404 final para rotas não encontradas')) {
  src += `\n\n// Middleware 404 final para rotas não encontradas\napp.use((req, res) => {\n  res.status(404).json({\n    sucesso: false,\n    erro: 'Rota não encontrada',\n    codigo: 'ROUTE_NOT_FOUND',\n    rota: req.originalUrl,\n    metodo: req.method\n  });\n});\n`;
  changed = true;
}

if (!changed) {
  console.log('Nenhuma alteração aplicada.');
  process.exit(0);
}
fs.writeFileSync(targetPath, src, 'utf8');
console.log('Patch aplicado com sucesso em', targetPath);