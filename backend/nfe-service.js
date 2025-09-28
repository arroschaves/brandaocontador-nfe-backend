const fs = require("fs");
const path = require("path");
const { carregarCertificado, assinarNFe } = require("./assinador");

// Configurações do ambiente
const CERT_PATH = process.env.CERT_PATH;
const CERT_PASS = process.env.CERT_PASS || "";
const XMLS_DIR = path.join(__dirname, "xmls");

// Cria pasta xmls se não existir
if (!fs.existsSync(XMLS_DIR)) fs.mkdirSync(XMLS_DIR);

// Gera um XML de teste da NFe
const xml = `
<NFe>
  <infNFe Id="NFe12345678901234567890123456789012345678901234" versao="4.00">
    <ide>
      <cUF>MS</cUF>
      <cNF>12345678</cNF>
      <natOp>Venda</natOp>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>1234</nNF>
      <dhEmi>2025-09-27T12:00:00-03:00</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>5006272</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>0</cDV>
      <tpAmb>${process.env.AMBIENTE}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${process.env.CNPJ_EMITENTE}</CNPJ>
      <xNome>MAP LTDA</xNome>
      <enderEmit>
        <xLgr>Rua Teste</xLgr>
        <nro>100</nro>
        <xBairro>Centro</xBairro>
        <cMun>5006272</cMun>
        <xMun>Sidrolândia</xMun>
        <UF>${process.env.UF}</UF>
        <CEP>79170000</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderEmit>
      <IE>123456789</IE>
      <CRT>3</CRT>
    </emit>
    <det nItem="1">
      <prod>
        <cProd>001</cProd>
        <xProd>Produto de Teste</xProd>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>1.00</qCom>
        <vUnCom>100.00</vUnCom>
        <vProd>100.00</vProd>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>100.00</vBC>
            <pICMS>17.00</pICMS>
            <vICMS>17.00</vICMS>
          </ICMS00>
        </ICMS>
      </imposto>
    </det>
    <total>
      <ICMSTot>
        <vBC>100.00</vBC>
        <vICMS>17.00</vICMS>
        <vProd>100.00</vProd>
        <vNF>117.00</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>
`;

const xmlPath = path.join(XMLS_DIR, "nfe.xml");
fs.writeFileSync(xmlPath, xml, "utf-8");
console.log("✅ XML de teste gerado em:", xmlPath);

// Carrega certificado
let chavePrivada, certificado;
try {
    const certData = carregarCertificado(CERT_PATH, CERT_PASS);
    chavePrivada = certData.chavePrivada;
    certificado = certData.certificado;
} catch (err) {
    console.error("❌ Erro ao carregar certificado:", err.message);
    process.exit(1);
}

// Assina XML
try {
    const xmlAssinado = assinarNFe(xml, chavePrivada, certificado);
    const xmlAssinadoPath = path.join(XMLS_DIR, "nfe-assinada.xml");
    fs.writeFileSync(xmlAssinadoPath, xmlAssinado, "utf-8");
    console.log("✅ XML assinado gerado em:", xmlAssinadoPath);
} catch (err) {
    console.error("❌ Erro na assinatura:", err.message);
    process.exit(1);
}
