const MAP = {
  autorizacao: {
    sucesso: ["100"],
    rejeicao: ["102","110","204","539","656"],
    denegada: ["301","302","303"],
    cancelada: ["135","136","155"],
  },
  consulta: {
    autorizada: ["100"],
    cancelada: ["135","136","155"],
    denegada: ["301","302","303"],
    inexistente: ["106","562"],
  },
  cancelamento: {
    sucesso: ["135","136","155"],
  },
  inutilizacao: {
    sucesso: ["102"],
  },
};

function estadoPorCodigo(op, cStat) {
  const s = String(cStat);
  const m = MAP[op] || {};
  for (const [estado, lista] of Object.entries(m)) {
    if (lista.includes(s)) return estado;
  }
  return "indefinido";
}

module.exports = { MAP, estadoPorCodigo };
