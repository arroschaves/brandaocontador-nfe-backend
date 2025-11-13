const xml2js = require("xml2js");

async function parseXml(xml) {
  const p = new xml2js.Parser({ explicitArray: false });
  return p.parseStringPromise(xml);
}

async function parseAutorizacao(xml) {
  const doc = await parseXml(xml);
  const ret = doc.retEnviNFe || doc.enviNFe || doc;
  const infProt = ret?.protNFe?.infProt || ret?.infProt || {};
  return {
    cStat: infProt.cStat,
    xMotivo: infProt.xMotivo,
    nProt: infProt.nProt,
    chNFe: infProt.chNFe,
  };
}

async function parseConsulta(xml) {
  const doc = await parseXml(xml);
  const ret = doc.retConsSitNFe || doc.consSitNFe || doc;
  const infProt = ret?.protNFe?.infProt || ret?.infProt || {};
  return {
    cStat: ret?.cStat || infProt.cStat,
    xMotivo: ret?.xMotivo || infProt.xMotivo,
    nProt: infProt.nProt,
    chNFe: infProt.chNFe,
  };
}

async function parseCancelamento(xml) {
  const doc = await parseXml(xml);
  const ret = doc.retEvento || doc.envEvento || doc;
  const infEvento = ret?.infEvento || ret?.retEvento?.infEvento || {};
  return {
    cStat: infEvento.cStat || ret.cStat,
    xMotivo: infEvento.xMotivo || ret.xMotivo,
    nProt: infEvento.nProt,
    chNFe: infEvento.chNFe,
  };
}

async function parseInutilizacao(xml) {
  const doc = await parseXml(xml);
  const ret = doc.retInutNFe || doc.inutNFe || doc;
  const inf = ret?.infInut || ret?.retInutNFe?.infInut || {};
  return {
    cStat: inf.cStat || ret.cStat,
    xMotivo: inf.xMotivo || ret.xMotivo,
    nProt: inf.nProt,
  };
}

module.exports = {
  parseAutorizacao,
  parseConsulta,
  parseCancelamento,
  parseInutilizacao,
};
