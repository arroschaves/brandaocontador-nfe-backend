const express = require('express');
const app = express();
const PORT = 3001; // Porta que o backend vai usar

app.get('/nfe/teste', (req, res) => {
  res.json({ status: "API NF-e funcionando perfeitamente!" });
});

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});