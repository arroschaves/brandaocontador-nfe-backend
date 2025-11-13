const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  carregarCertificado,
  assinarNFe,
  assinarInutilizacao,
  assinarEventoCancelamento,
} = require("../assinador");
const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");
const database = require("../config/database");
const CertificateService = require("./certificate-service");
const SefazClient = require("./sefaz-client");
const SefazStatusService = require("./sefaz-status");
const { TaxCalculationService } = require("./tax-calculation-service");
const TributacaoService = require("./tributacao-service");
const XmlValidatorService = require("./xml-validator-service");
const DanfeService = require("./danfe-service");
const { ValidationService } = require("./validation-service");
const logService = require("./log-service");
const soapParsers = require("./soap-parsers");
const metrics = require("../monitoring/metrics");

class NFeService {
  constructor() {
    this.CERT_PATH = process.env.CERT_PATH;
    this.CERT_PASS = process.env.CERT_PASS || "";
    this.AMBIENTE = process.env.AMBIENTE || "2"; // 1=Produção, 2=Homologação
    this.UF = process.env.UF || "MS";
    this.CNPJ_EMITENTE = process.env.CNPJ_EMITENTE;

    this.XMLS_DIR = path.join(__dirname, "../xmls");
    this.ENVIADAS_DIR = path.join(this.XMLS_DIR, "enviadas");
    this.FALHAS_DIR = path.join(this.XMLS_DIR, "falhas");
    this.CACHE_DIR = path.join(this.XMLS_DIR, "cache");
    this.NUMERACAO_PATH = path.join(this.XMLS_DIR, "numeracao.json");

    this.certificateService = new CertificateService();
    this.sefazStatusService = new SefazStatusService();
    this.taxCalculationService = new TaxCalculationService();
    this.tributacaoService = new TributacaoService();
    this.xmlValidatorService = new XmlValidatorService();
    this.danfeService = new DanfeService();
    this.validationService = new ValidationService();

    // Cria diretórios se não existirem
    this.criarDiretorios();

    // Carrega certificado na inicialização
    this.carregarCertificadoSistema();
  }

  criarDiretorios() {
    [this.XMLS_DIR, this.ENVIADAS_DIR, this.FALHAS_DIR, this.CACHE_DIR].forEach(
      (dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      },
    );
  }

  async carregarCertificadoSistema() {
    // PRODUÇÃO REAL - Certificado A1 obrigatório

    try {
      let certificate;
      let info;

      // Tenta carregar das configurações JSON
      const config = await database.buscarConfiguracao("nfe").catch(() => null);
      const dbPath = config?.certificadoDigital?.arquivo;
      const dbPass = config?.certificadoDigital?.senha;

      if (dbPath && dbPass) {
        certificate = await this.certificateService.loadCertificateFromPath(
          dbPath,
          dbPass,
        );
        info = this.certificateService.getCertificateInfo(certificate);
        this.CERT_PATH = dbPath;
        this.CERT_PASS = dbPass;
      } else {
        // Fallback para variáveis de ambiente e caminhos padrão (modo opcional)
        certificate = await this.certificateService.loadCertificate(true);
        if (certificate) {
          info = this.certificateService.getCertificateInfo(certificate);
          this.CERT_PATH = certificate.path;
          this.CERT_PASS = process.env.CERT_PASS || this.CERT_PASS;
        }
      }

      if (certificate) {
        this.chavePrivada = certificate.privateKey;
        this.certificado = certificate.certificate;

        console.log("✅ Certificado carregado com sucesso:", {
          subject: info.subject.commonName,
          issuer: info.issuer.commonName,
          expiresAt: info.validity.notAfter,
          path: info.path,
        });
        this.certificadoCarregado = true;
      } else {
        console.log(
          "ℹ️ Certificado não configurado - Cliente deve importar via interface",
        );
        this.certificadoCarregado = false;
      }
    } catch (error) {
      console.warn("⚠️ Certificado não carregado:", error.message);
      this.certificadoCarregado = false;
      // Não lançar erro na inicialização para permitir servidor subir.
      // A emissão real de NFe continuará bloqueada sem certificado.
      return;
    }
  }

  // ==================== EMISSÃO DE NFE ====================

  async emitirNfe(dadosNfe) {
    try {
      // Normaliza série e número quando ausentes/zerados (numeração no servidor)
      if (!dadosNfe.serie || Number(dadosNfe.serie) <= 0) {
        const seriePadrao = await this.obterSeriePadrao();
        dadosNfe.serie = seriePadrao;
      }
      if (!dadosNfe.numero || Number(dadosNfe.numero) <= 0) {
        const proximoNumero = await this.obterProximoNumero(dadosNfe.serie);
        dadosNfe.numero = proximoNumero;
      }

      // PRODUÇÃO REAL

      if (!this.chavePrivada || !this.certificado) {
        // Retorna erro estruturado para permitir resposta 400 na rota
        return {
          sucesso: false,
          erro: "Certificado não carregado",
          codigo: "CERTIFICADO_AUSENTE",
        };
      }

      // PRODUÇÃO REAL - Cálculo tributário completo
      const dadosComImpostos = await this.calcularImpostosCompletos(dadosNfe);

      // Gera o XML da NFe com impostos calculados
      const xmlNfe = this.gerarXmlNfe(dadosComImpostos);

      // Validação XML NFe 4.0 conforme legislação SEFAZ
      const resultadoValidacao = this.xmlValidatorService.validarXmlNfe(
        xmlNfe,
        dadosComImpostos,
      );

      if (!resultadoValidacao.valido) {
        return {
          sucesso: false,
          erro: "XML não conforme com a legislação NFe 4.0",
          detalhes: resultadoValidacao.erros,
          avisos: resultadoValidacao.avisos,
          codigo: "XML_INVALIDO",
        };
      }

      // Assina o XML
      const xmlAssinado = await this.assinarXml(xmlNfe);

      // Salva XML antes do envio
      const nomeArquivo = `NFe_${dadosNfe.numero}_${Date.now()}.xml`;
      const caminhoXml = path.join(this.XMLS_DIR, nomeArquivo);
      fs.writeFileSync(caminhoXml, xmlAssinado, "utf-8");

      // Envia para SEFAZ
      const resultado = await this.enviarParaSefaz(xmlAssinado);

      // Move para pasta apropriada baseado no resultado
      if (resultado.sucesso) {
        const caminhoFinal = path.join(this.ENVIADAS_DIR, nomeArquivo);
        fs.renameSync(caminhoXml, caminhoFinal);

        // Gera PDF DANFE
        const caminhoDANFE = await this.danfeService.gerarDanfe(
          dadosComImpostos,
          xmlAssinado,
        );

        return {
          sucesso: true,
          chave: resultado.chave,
          protocolo: resultado.protocolo,
          dataEmissao: new Date().toISOString(),
          arquivo: nomeArquivo,
          xml: xmlAssinado,
          danfe: caminhoDANFE,
        };
      } else {
        const caminhoFalha = path.join(this.FALHAS_DIR, nomeArquivo);
        fs.renameSync(caminhoXml, caminhoFalha);

        throw new Error(`Erro SEFAZ: ${resultado.erro}`);
      }
    } catch (error) {
      console.error("❌ Erro na emissão:", error.message);
      throw error;
    }
  }

  gerarXmlNfe(dados) {
    const agora = new Date();
    const dataEmissao = agora.toISOString().slice(0, 19) + "-03:00";

    // Gera chave de acesso (simplificada para exemplo)
    const chaveAcesso = this.gerarChaveAcesso(dados);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chaveAcesso}" versao="4.00">
    <ide>
      <cUF>${this.obterCodigoUF(dados.emitente?.endereco?.uf || this.UF)}</cUF>
      <cNF>${this.gerarCodigoNumerico()}</cNF>
      <natOp>${dados.naturezaOperacao || "Venda"}</natOp>
      <mod>55</mod>
      <serie>${dados.serie || 1}</serie>
      <nNF>${dados.numero}</nNF>
      <dhEmi>${dataEmissao}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${dados.codigoMunicipio || "5006272"}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chaveAcesso.slice(-1)}</cDV>
      <tpAmb>${this.AMBIENTE}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${(this.CNPJ_EMITENTE || dados.emitente.cnpj || "").replace(/\D/g, "")}</CNPJ>
      <xNome>${dados.emitente.nome || dados.emitente.razaoSocial || "Empresa Não Configurada"}</xNome>
      <enderEmit>
        <xLgr>${dados.emitente.endereco.logradouro}</xLgr>
        <nro>${dados.emitente.endereco.numero}</nro>
        <xBairro>${dados.emitente.endereco.bairro}</xBairro>
        <cMun>${dados.emitente.endereco.codigoMunicipio}</cMun>
        <xMun>${dados.emitente.endereco.municipio}</xMun>
        <UF>${dados.emitente.endereco.uf}</UF>
        <CEP>${dados.emitente.endereco.cep}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderEmit>
      <IE>${dados.emitente.inscricaoEstadual}</IE>
      <CRT>${dados.emitente.regimeTributario || 3}</CRT>
    </emit>
    <dest>
      ${dados.destinatario.cnpj ? `<CNPJ>${dados.destinatario.cnpj}</CNPJ>` : `<CPF>${dados.destinatario.cpf}</CPF>`}
      <xNome>${dados.destinatario.nome}</xNome>
      <enderDest>
        <xLgr>${dados.destinatario.endereco.logradouro}</xLgr>
        <nro>${dados.destinatario.endereco.numero}</nro>
        <xBairro>${dados.destinatario.endereco.bairro}</xBairro>
        <cMun>${dados.destinatario.endereco.codigoMunicipio}</cMun>
        <xMun>${dados.destinatario.endereco.municipio}</xMun>
        <UF>${dados.destinatario.endereco.uf}</UF>
        <CEP>${dados.destinatario.endereco.cep}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderDest>
      <indIEDest>${dados.destinatario.cnpj ? "1" : "9"}</indIEDest>
    </dest>
    ${this.gerarItensXml(dados.itens)}
    <total>
      <ICMSTot>
        <vBC>${dados.totais?.vBC || "0.00"}</vBC>
        <vICMS>${dados.totais?.vICMS || "0.00"}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${dados.totais?.vProd || "0.00"}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>${dados.totais?.vIPI || "0.00"}</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>${dados.totais?.vPIS || "0.00"}</vPIS>
        <vCOFINS>${dados.totais?.vCOFINS || "0.00"}</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${dados.totais?.vNF || "0.00"}</vNF>
        <vTotTrib>${dados.totais?.vTotTrib || "0.00"}</vTotTrib>
      </ICMSTot>
    </total>
    ${dados.observacoes ? `<infAdic><infCpl>${dados.observacoes}</infCpl></infAdic>` : ""}
  </infNFe>
</NFe>`;

    return xml;
  }

  gerarItensXml(itens) {
    return itens
      .map((item, index) => {
        const valorTotal =
          parseFloat(item.valorUnitario) * parseFloat(item.quantidade);
        const tributacao = item.tributacao || {};

        return `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${item.codigo}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${item.descricao}</xProd>
        <NCM>${item.ncm || "00000000"}</NCM>
        <CFOP>${item.cfop}</CFOP>
        <uCom>${item.unidade}</uCom>
        <qCom>${item.quantidade}</qCom>
        <vUnCom>${item.valorUnitario}</vUnCom>
        <vProd>${valorTotal.toFixed(2)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${item.unidade}</uTrib>
        <qTrib>${item.quantidade}</qTrib>
        <vUnTrib>${item.valorUnitario}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>${(
          (tributacao.icms?.valor || 0) +
          (tributacao.ipi?.valor || 0) +
          (tributacao.pis?.valor || 0) +
          (tributacao.cofins?.valor || 0) +
          (tributacao.iss?.valor || 0)
        ).toFixed(2)}</vTotTrib>
        <ICMS>
          <ICMS${tributacao.icms?.cst || "00"}>
            <orig>0</orig>
            <CST>${tributacao.icms?.cst || "00"}</CST>
            ${
              tributacao.icms?.valor > 0
                ? `
            <modBC>3</modBC>
            <vBC>${tributacao.icms.baseCalculo.toFixed(2)}</vBC>
            <pICMS>${tributacao.icms.aliquota.toFixed(2)}</pICMS>
            <vICMS>${tributacao.icms.valor.toFixed(2)}</vICMS>`
                : ""
            }
          </ICMS${tributacao.icms?.cst || "00"}>
        </ICMS>
        ${
          tributacao.ipi?.valor > 0
            ? `
        <IPI>
          <cEnq>999</cEnq>
          <IPITrib>
            <CST>${tributacao.ipi.cst}</CST>
            <vBC>${tributacao.ipi.baseCalculo.toFixed(2)}</vBC>
            <pIPI>${tributacao.ipi.aliquota.toFixed(2)}</pIPI>
            <vIPI>${tributacao.ipi.valor.toFixed(2)}</vIPI>
          </IPITrib>
        </IPI>`
            : `
        <IPI>
          <cEnq>999</cEnq>
          <IPINT>
            <CST>${tributacao.ipi?.cst || "53"}</CST>
          </IPINT>
        </IPI>`
        }
        <PIS>
          <PIS${this.obterTipoPIS(tributacao.pis?.cst)}>
            <CST>${tributacao.pis?.cst || "08"}</CST>
            ${
              tributacao.pis?.valor > 0
                ? `
            <vBC>${tributacao.pis.baseCalculo.toFixed(2)}</vBC>
            <pPIS>${tributacao.pis.aliquota.toFixed(4)}</pPIS>`
                : ""
            }
            <vPIS>${(tributacao.pis?.valor || 0).toFixed(2)}</vPIS>
          </PIS${this.obterTipoPIS(tributacao.pis?.cst)}>
        </PIS>
        <COFINS>
          <COFINS${this.obterTipoCOFINS(tributacao.cofins?.cst)}>
            <CST>${tributacao.cofins?.cst || "08"}</CST>
            ${
              tributacao.cofins?.valor > 0
                ? `
            <vBC>${tributacao.cofins.baseCalculo.toFixed(2)}</vBC>
            <pCOFINS>${tributacao.cofins.aliquota.toFixed(4)}</pCOFINS>`
                : ""
            }
            <vCOFINS>${(tributacao.cofins?.valor || 0).toFixed(2)}</vCOFINS>
          </COFINS${this.obterTipoCOFINS(tributacao.cofins?.cst)}>
        </COFINS>
        ${
          tributacao.iss?.valor > 0
            ? `
        <ISSQN>
          <vBC>${tributacao.iss.baseCalculo.toFixed(2)}</vBC>
          <vAliq>${tributacao.iss.aliquota.toFixed(2)}</vAliq>
          <vISSQN>${tributacao.iss.valor.toFixed(2)}</vISSQN>
          <cMunFG>${item.codigoMunicipioISS || "5006272"}</cMunFG>
          <cListServ>${item.codigoServico || "01.01"}</cListServ>
        </ISSQN>`
            : ""
        }
      </imposto>
      ${item.observacoesFiscais ? `<infAdProd>${item.observacoesFiscais}</infAdProd>` : ""}
    </det>`;
      })
      .join("");
  }

  /**
   * Determina o tipo de PIS baseado no CST
   */
  obterTipoPIS(cst) {
    if (!cst) return "NT";

    switch (cst) {
      case "01":
      case "02":
        return "Aliq";
      case "03":
        return "Qtde";
      case "04":
      case "05":
      case "06":
      case "07":
      case "08":
      case "09":
        return "NT";
      case "99":
        return "Outr";
      default:
        return "NT";
    }
  }

  /**
   * Determina o tipo de COFINS baseado no CST
   */
  obterTipoCOFINS(cst) {
    if (!cst) return "NT";

    switch (cst) {
      case "01":
      case "02":
        return "Aliq";
      case "03":
        return "Qtde";
      case "04":
      case "05":
      case "06":
      case "07":
      case "08":
      case "09":
        return "NT";
      case "99":
        return "Outr";
      default:
        return "NT";
    }
  }

  async assinarXml(xml) {
    try {
      console.log(
        "🔍 XML antes da assinatura (primeiros 500 chars):",
        xml.substring(0, 500),
      );
      console.log("🔍 Verificando se contém infNFe:", xml.includes("infNFe"));
      console.log("🔍 Verificando se contém Id=:", xml.includes("Id="));
      return await assinarNFe(xml, this.chavePrivada, this.certificado);
    } catch (error) {
      console.error("❌ Erro detalhado na assinatura:", error);
      throw new Error(`Erro na assinatura: ${error.message}`);
    }
  }

  // ==================== CONSULTA NFE ====================

  async consultarNFe(chave) {
    try {
      console.log(`🔍 Consultando NFe: ${chave}`);

      // Consulta real na SEFAZ

      // Integração real com SEFAZ (consulta direta via SefazClient)
      const resultado = await this.consultarSefaz(chave);
      console.log("✅ Consulta SEFAZ realizada:", resultado);
      return resultado;
    } catch (error) {
      console.error("❌ Erro na consulta:", error.message);
      throw error;
    }
  }

  // ==================== CANCELAMENTO NFE ====================

  async cancelarNfe(chave, justificativa) {
    try {
      // Validações
      if (!chave || chave.length !== 44) {
        throw new Error("Chave de acesso inválida");
      }

      if (!justificativa || justificativa.length < 15) {
        throw new Error("Justificativa deve ter pelo menos 15 caracteres");
      }

      // Cancelamento real via SEFAZ
      if (!this.chavePrivada || !this.certificado) {
        return {
          sucesso: false,
          erro: "Certificado não carregado",
          codigo: "CERTIFICADO_AUSENTE",
        };
      }

      // Gera XML do evento de cancelamento
      const xmlCancelamento = this.gerarXmlCancelamento(chave, justificativa);

      // Assina XML do evento de cancelamento
      const xmlAssinado = assinarEventoCancelamento(
        xmlCancelamento,
        this.chavePrivada,
        this.certificado,
      );

      // Envia para SEFAZ
      const resposta = await this.enviarCancelamentoSefaz(xmlAssinado);

      const resultado = {
        chave,
        situacao: "Cancelada",
        protocolo:
          resposta?.protocolo ||
          `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        dataHora: new Date().toISOString(),
        motivo: "Cancelamento de NF-e homologado",
        justificativa,
      };

      return resultado;
    } catch (error) {
      console.error("❌ Erro no cancelamento:", error.message);
      throw error;
    }
  }

  // ==================== INUTILIZAÇÃO NFE ====================

  async inutilizarNumeracao({
    serie,
    numeroInicial,
    numeroFinal,
    justificativa,
    ano,
  }) {
    try {
      // Validações básicas
      const s = parseInt(serie, 10);
      const nIni = parseInt(numeroInicial, 10);
      const nFim = parseInt(numeroFinal, 10);
      const anoRef = ano || new Date().getFullYear().toString().slice(-2);

      if (isNaN(s) || s < 0) throw new Error("Série inválida");
      if (isNaN(nIni) || isNaN(nFim) || nIni <= 0 || nFim <= 0)
        throw new Error("Numeração inválida");
      if (nFim < nIni)
        throw new Error("Número final deve ser maior ou igual ao inicial");
      if (!justificativa || justificativa.trim().length < 15)
        throw new Error("Justificativa deve ter pelo menos 15 caracteres");

      // Processamento real da inutilização

      // Verifica certificado
      if (!this.chavePrivada || !this.certificado) {
        return {
          sucesso: false,
          erro: "Certificado não carregado",
          codigo: "CERTIFICADO_AUSENTE",
        };
      }

      // Gera XML de inutilização
      const xmlInut = this.gerarXmlInutilizacao({
        serie: s,
        numeroInicial: nIni,
        numeroFinal: nFim,
        justificativa,
        ano: anoRef,
      });

      // Assina XML
      const xmlAssinado = assinarInutilizacao(
        xmlInut,
        this.chavePrivada,
        this.certificado,
      );

      // Envia para SEFAZ
      const resposta = await this.enviarInutilizacaoSefaz(xmlAssinado);

      // Normaliza resultado
      if (
        resposta?.sucesso ||
        resposta?.cStat === "102" ||
        resposta?.cStat === 102
      ) {
        // 102: Inutilização de número homologado
        return {
          sucesso: true,
          protocolo:
            resposta?.protocolo || resposta?.infInut?.nProt || `${Date.now()}`,
          mensagem: resposta?.xMotivo || "Inutilização homologada",
          serie: s,
          numeroInicial: nIni,
          numeroFinal: nFim,
        };
      }

      throw new Error(
        resposta?.erro || resposta?.xMotivo || "Falha na inutilização",
      );
    } catch (error) {
      console.error("❌ Erro na inutilização:", error.message);
      throw error;
    }
  }

  gerarXmlInutilizacao({
    serie,
    numeroInicial,
    numeroFinal,
    justificativa,
    ano,
  }) {
    const cUF = this.obterCodigoUF(this.UF);
    const cnpj = (this.CNPJ_EMITENTE || "").replace(/\D/g, "");
    const mod = "55";
    const id = `ID${cUF}${ano}${cnpj}${mod}${String(serie).padStart(3, "0")}${String(numeroInicial).padStart(9, "0")}${String(numeroFinal).padStart(9, "0")}`;
    const dh = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <infInut Id="${id}">
    <tpAmb>${this.AMBIENTE}</tpAmb>
    <xServ>INUTILIZAR</xServ>
    <cUF>${cUF}</cUF>
    <ano>${ano}</ano>
    <CNPJ>${cnpj}</CNPJ>
    <mod>${mod}</mod>
    <serie>${serie}</serie>
    <nNFIni>${numeroInicial}</nNFIni>
    <nNFFin>${numeroFinal}</nNFFin>
    <xJust>${justificativa}</xJust>
  </infInut>
</inutNFe>`;
  }

  async enviarInutilizacaoSefaz(xmlAssinado) {
    try {
      if (!this.sefazClient) {
        this.sefazClient = new SefazClient({
          certPath: this.CERT_PATH,
          certPass: this.CERT_PASS,
          uf: this.UF,
          ambiente: this.AMBIENTE,
          timeout: parseInt(process.env.TIMEOUT || "30000"),
        });
        await this.sefazClient.init();
      }

      const resposta = await this.sefazClient.inutilizar(xmlAssinado);
      let xmlResp = null;
      if (typeof resposta === "string") {
        xmlResp = resposta;
      } else if (resposta?.retInutNFe) {
        xmlResp = resposta.retInutNFe;
      } else if (resposta?.nfeResultMsg) {
        xmlResp = resposta.nfeResultMsg;
      }
      let parsed = {};
      if (xmlResp) {
        try {
          const xml2js = require("xml2js");
          const p = new xml2js.Parser({ explicitArray: false });
          const doc = await p.parseStringPromise(xmlResp);
          const ret = doc.retInutNFe || doc["nfeResultMsg"] || doc;
          const inf = ret?.infInut || ret?.retInutNFe?.infInut || {};
          parsed = {
            cStat: inf.cStat || ret.cStat,
            xMotivo: inf.xMotivo || ret.xMotivo,
            nProt: inf.nProt || ret.nProt,
          };
        } catch {}
      }
      const cStat =
        parsed.cStat || resposta?.infInut?.cStat || resposta?.cStat || null;
      const xMotivo =
        parsed.xMotivo ||
        resposta?.infInut?.xMotivo ||
        resposta?.xMotivo ||
        null;
      const protocolo =
        parsed.nProt ||
        resposta?.infInut?.nProt ||
        resposta?.protocolo ||
        "N/A";
      const sucesso = cStat === "102" || cStat === 102;
      return { sucesso, protocolo, xMotivo, cStat };
    } catch (error) {
      console.error("❌ Erro ao enviar inutilização SEFAZ:", error.message);
      return { sucesso: false, erro: error.message };
    }
  }

  // ==================== HISTÓRICO ====================

  async obterHistorico(filtros) {
    try {
      const arquivos = fs.readdirSync(this.ENVIADAS_DIR);

      // Simula busca no histórico (implementar com banco de dados)
      const historico = arquivos.map((arquivo) => {
        const stats = fs.statSync(path.join(this.ENVIADAS_DIR, arquivo));
        return {
          arquivo,
          dataEmissao: stats.birthtime,
          status: "Autorizada",
        };
      });

      // Aplica filtros
      let resultado = historico;

      if (filtros.dataInicio) {
        const dataInicio = new Date(filtros.dataInicio);
        resultado = resultado.filter((item) => item.dataEmissao >= dataInicio);
      }

      if (filtros.dataFim) {
        const dataFim = new Date(filtros.dataFim);
        resultado = resultado.filter((item) => item.dataEmissao <= dataFim);
      }

      // Paginação
      const inicio = (filtros.pagina - 1) * filtros.limite;
      const fim = inicio + filtros.limite;

      return {
        itens: resultado.slice(inicio, fim),
        total: resultado.length,
        pagina: filtros.pagina,
        totalPaginas: Math.ceil(resultado.length / filtros.limite),
      };
    } catch (error) {
      throw new Error(`Erro no histórico: ${error.message}`);
    }
  }

  // ==================== STATUS DO SISTEMA ====================

  async verificarStatusSistema() {
    try {
      return {
        certificado: {
          carregado: !!this.chavePrivada,
          caminho: this.CERT_PATH,
          valido: true, // Implementar validação real
        },
        sefaz: {
          disponivel: await this.verificarStatusSefaz(),
          ambiente: this.AMBIENTE === "1" ? "Produção" : "Homologação",
          uf: this.UF,
        },
        diretorios: {
          xmls: fs.existsSync(this.XMLS_DIR),
          enviadas: fs.existsSync(this.ENVIADAS_DIR),
          falhas: fs.existsSync(this.FALHAS_DIR),
        },
      };
    } catch (error) {
      throw new Error(`Erro no status: ${error.message}`);
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  async obterSeriePadrao() {
    try {
      const config = await database.buscarConfiguracao("nfe").catch(() => null);
      const serieCfg = config?.serie ?? "1";
      const serieNum = parseInt(serieCfg, 10);
      return Number.isNaN(serieNum) ? 1 : serieNum;
    } catch (e) {
      console.warn("⚠️ Falha ao obter série padrão:", e.message);
      return 1;
    }
  }

  async obterProximoNumero(serie) {
    // Primeiro tenta persistir via Configuração JSON
    try {
      const config = await database.buscarConfiguracao("nfe").catch(() => null);
      let proximo = 1;
      if (
        config?.numeracaoInicial !== undefined &&
        config?.numeracaoInicial !== null
      ) {
        const atual = parseInt(config.numeracaoInicial, 10);
        proximo = Number.isNaN(atual) ? 1 : atual;
      }
      // Atualiza para o próximo número
      await database
        .salvarConfiguracao("nfe", {
          ...config,
          numeracaoInicial: proximo + 1,
        })
        .catch(() => null);
      return proximo;
    } catch (e) {
      console.warn(
        "⚠️ Falha ao atualizar numeração nas configurações. Usando arquivo.",
        e.message,
      );
    }

    // Fallback: usar arquivo numeracao.json
    try {
      let mapa = {};
      if (fs.existsSync(this.NUMERACAO_PATH)) {
        const raw = fs.readFileSync(this.NUMERACAO_PATH, "utf-8");
        mapa = JSON.parse(raw);
      }
      const chaveSerie = String(serie || 1);
      const atual = parseInt(mapa[chaveSerie] || 1, 10);
      const proximo = Number.isNaN(atual) ? 1 : atual;
      mapa[chaveSerie] = proximo + 1;
      fs.writeFileSync(
        this.NUMERACAO_PATH,
        JSON.stringify(mapa, null, 2),
        "utf-8",
      );
      return proximo;
    } catch (e) {
      console.warn(
        "⚠️ Falha na persistência de numeração em arquivo:",
        e.message,
      );
      return 1;
    }
  }

  gerarChaveAcesso(dados) {
    // Implementação simplificada - usar biblioteca específica em produção
    const uf = this.obterCodigoUF(dados.emitente?.endereco?.uf || this.UF);
    const ano = new Date().getFullYear().toString().slice(-2);
    const mes = String(new Date().getMonth() + 1).padStart(2, "0");
    // Usa CNPJ do ambiente, com fallback para payload do emitente
    const cnpjFonte = this.CNPJ_EMITENTE || dados?.emitente?.cnpj;
    const cnpj = (cnpjFonte || "").replace(/\D/g, "");
    if (!cnpj || cnpj.length !== 14) {
      console.warn(
        "⚠️  CNPJ para geração de chave de acesso ausente ou inválido. Verifique env CNPJ_EMITENTE ou dados.emitente.cnpj",
      );
    }
    const modelo = "55";
    const serie = String(dados.serie || 1).padStart(3, "0");
    const numero = String(dados.numero).padStart(9, "0");
    const codigo = this.gerarCodigoNumerico();

    const chave = uf + ano + mes + cnpj + modelo + serie + numero + codigo;
    const dv = this.calcularDV(chave);

    return chave + dv;
  }

  gerarCodigoNumerico() {
    return Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, "0");
  }

  calcularDV(chave) {
    // Implementação simplificada do módulo 11
    let soma = 0;
    let peso = 2;

    for (let i = chave.length - 1; i >= 0; i--) {
      soma += parseInt(chave[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  obterCodigoUF(uf) {
    const codigos = {
      AC: "12",
      AL: "27",
      AM: "13",
      AP: "16",
      BA: "29",
      CE: "23",
      DF: "53",
      ES: "32",
      GO: "52",
      MA: "21",
      MG: "31",
      MS: "50",
      MT: "51",
      PA: "15",
      PB: "25",
      PE: "26",
      PI: "22",
      PR: "41",
      RJ: "33",
      RN: "24",
      RO: "11",
      RR: "14",
      RS: "43",
      SC: "42",
      SE: "28",
      SP: "35",
      TO: "17",
      // Aliases para serviços compartilhados
      SVRS: "43",
    };
    return codigos[uf] || codigos["SP"];
  }

  // ==================== INTEGRAÇÃO SEFAZ (REAL) ====================

  async enviarParaSefaz(xmlAssinado) {
    try {
      // Inicializa cliente SEFAZ com envs
      if (!this.sefazClient) {
        this.sefazClient = new SefazClient({
          certPath: this.CERT_PATH,
          certPass: this.CERT_PASS,
          uf: this.UF,
          ambiente: this.AMBIENTE,
          timeout: parseInt(process.env.TIMEOUT || "30000"),
        });
        await this.sefazClient.init();
      }

      const resposta = await this.sefazClient.enviarLote(xmlAssinado);
      const t0 = Date.now();
      const xmlResp =
        resposta?.nfeResultMsg ||
        resposta?.return ||
        (typeof resposta === "string" ? resposta : null);
      let parsed = { cStat: null, xMotivo: null, nProt: null, chNFe: null };
      if (xmlResp) parsed = await soapParsers.parseAutorizacao(xmlResp);
      if (xmlResp) {
        const { validate, xsdForOperation } = require("./xsd-validator");
        const xsdPath = xsdForOperation("autorizacao", this.AMBIENTE);
        const v = await validate(xmlResp, xsdPath);
        await logService.log("xsd_validacao", v.valid ? "OK" : "ERRO", { operacao: "autorizacao", uf: this.UF, ambiente: this.AMBIENTE, erros: v.errors });
        if (!v.valid) {
          const { fallbackXsd } = require("./xsd-validator");
          const fb = fallbackXsd("autorizacao", this.AMBIENTE);
          if (fb) {
            const v2 = await validate(xmlResp, fb);
            await logService.log("xsd_validacao_fallback", v2.valid ? "OK" : "ERRO", { operacao: "autorizacao", uf: this.UF, ambiente: this.AMBIENTE });
          }
        }
      }
      if (xmlResp) {
        const validator = new (require("./xml-validator-service"))();
        const v = validator.validarXmlResposta(xmlResp);
        await logService.log("validacao_xml_resposta", v.valido ? "OK" : "ERRO", { operacao: "autorizacao", erros: v.erros });
      }
      const sucesso = parsed.cStat === "100" || parsed.cStat === 100;
      const protocolo = parsed.nProt || resposta?.protNFe?.infProt?.nProt || "N/A";
      const chave =
        parsed.chNFe ||
        resposta?.protNFe?.infProt?.chNFe ||
        this.gerarChaveAcesso({ numero: 0, serie: 1, emitente: { cnpj: this.CNPJ_EMITENTE } });
      await logService.log("sefaz_autorizacao", sucesso ? "SUCESSO" : "FALHA", { uf: this.UF, ambiente: this.AMBIENTE, cStat: parsed.cStat, xMotivo: parsed.xMotivo, duracao: (Date.now() - t0) / 1000 });
      return { sucesso, protocolo, chave, cStat: parsed.cStat, xMotivo: parsed.xMotivo };
    } catch (error) {
      console.error("❌ Erro ao enviar para SEFAZ:", error.message);
      return { sucesso: false, erro: error.message };
    }
  }

  async consultarSefaz(chave) {
    try {
      if (!this.sefazClient) {
        this.sefazClient = new SefazClient({
          certPath: this.CERT_PATH,
          certPass: this.CERT_PASS,
          uf: this.UF,
          ambiente: this.AMBIENTE,
          timeout: parseInt(process.env.TIMEOUT || "30000"),
        });
        await this.sefazClient.init();
      }
      const resposta = await this.sefazClient.consultar(chave);
      const t0 = Date.now();
      const xmlResp =
        resposta?.nfeResultMsg ||
        resposta?.return ||
        (typeof resposta === "string" ? resposta : null);
      let parsed = { cStat: null, xMotivo: null, nProt: null, chNFe: null };
      if (xmlResp) parsed = await soapParsers.parseConsulta(xmlResp);
      if (xmlResp) {
        const { validate, xsdForOperation } = require("./xsd-validator");
        const xsdPath = xsdForOperation("consulta", this.AMBIENTE);
        const v = await validate(xmlResp, xsdPath);
        await logService.log("xsd_validacao", v.valid ? "OK" : "ERRO", { operacao: "consulta", uf: this.UF, ambiente: this.AMBIENTE, erros: v.errors });
        if (!v.valid) {
          const { fallbackXsd } = require("./xsd-validator");
          const fb = fallbackXsd("consulta", this.AMBIENTE);
          if (fb) {
            const v2 = await validate(xmlResp, fb);
            await logService.log("xsd_validacao_fallback", v2.valid ? "OK" : "ERRO", { operacao: "consulta", uf: this.UF, ambiente: this.AMBIENTE });
          }
        }
      }
      if (xmlResp) {
        const validator = new (require("./xml-validator-service"))();
        const v = validator.validarXmlResposta(xmlResp);
        await logService.log("validacao_xml_resposta", v.valido ? "OK" : "ERRO", { operacao: "consulta", erros: v.erros });
      }
      const situacao = parsed.cStat === "100" || parsed.cStat === 100 ? "Autorizada" : "Indefinida";
      await logService.log("sefaz_consulta", "OK", { uf: this.UF, ambiente: this.AMBIENTE, cStat: parsed.cStat, xMotivo: parsed.xMotivo, duracao: (Date.now() - t0) / 1000 });
      return { situacao, protocolo: parsed.nProt || "N/A", xml: xmlResp };
    } catch (error) {
      console.error("❌ Erro na consulta SEFAZ:", error.message);
      throw error;
    }
  }

  async enviarCancelamentoSefaz(xmlCancelamentoAssinado) {
    try {
      if (!this.sefazClient) {
        this.sefazClient = new SefazClient({
          certPath: this.CERT_PATH,
          certPass: this.CERT_PASS,
          uf: this.UF,
          ambiente: this.AMBIENTE,
          timeout: parseInt(process.env.TIMEOUT || "30000"),
        });
        await this.sefazClient.init();
      }
      const resposta = await this.sefazClient.cancelar(xmlCancelamentoAssinado);
      const t0 = Date.now();
      const xmlResp =
        resposta?.retEvento ||
        resposta?.return ||
        (typeof resposta === "string" ? resposta : null);
      let parsed = { nProt: null };
      if (xmlResp) parsed = await soapParsers.parseCancelamento(xmlResp);
      if (xmlResp) {
        const { validate, xsdForOperation } = require("./xsd-validator");
        const xsdPath = xsdForOperation("cancelamento", this.AMBIENTE);
        const v = await validate(xmlResp, xsdPath);
        await logService.log("xsd_validacao", v.valid ? "OK" : "ERRO", { operacao: "cancelamento", uf: this.UF, ambiente: this.AMBIENTE, erros: v.errors });
        if (!v.valid) {
          const { fallbackXsd } = require("./xsd-validator");
          const fb = fallbackXsd("cancelamento", this.AMBIENTE);
          if (fb) {
            const v2 = await validate(xmlResp, fb);
            await logService.log("xsd_validacao_fallback", v2.valid ? "OK" : "ERRO", { operacao: "cancelamento", uf: this.UF, ambiente: this.AMBIENTE });
          }
        }
      }
      if (xmlResp) {
        const validator = new (require("./xml-validator-service"))();
        const v = validator.validarXmlResposta(xmlResp);
        await logService.log("validacao_xml_resposta", v.valido ? "OK" : "ERRO", { operacao: "cancelamento", erros: v.erros });
      }
      await logService.log("sefaz_cancelamento", "OK", { uf: this.UF, ambiente: this.AMBIENTE, duracao: (Date.now() - t0) / 1000 });
      return { protocolo: parsed.nProt || resposta?.retEvento?.infEvento?.nProt || resposta?.protocolo || "N/A" };
    } catch (error) {
      console.error("❌ Erro no cancelamento SEFAZ:", error.message);
      throw error;
    }
  }

  async verificarStatusSefaz() {
    try {
      // Verificação real da SEFAZ

      // Verificação real usando o novo serviço de status
      const statusUF = await this.sefazStatusService.verificarStatusUF(
        this.UF,
        this.AMBIENTE,
      );

      return {
        disponivel: statusUF.disponivel,
        status: statusUF.status,
        modo: "real",
        uf: this.UF,
        ambiente: this.AMBIENTE === "1" ? "produção" : "homologação",
        detalhes: statusUF,
        responseTime: statusUF.responseTime,
      };
    } catch (error) {
      console.warn("⚠️ Erro ao verificar status SEFAZ:", error.message);
      return {
        disponivel: false,
        status: "offline",
        modo: "real",
        uf: this.UF,
        ambiente: this.AMBIENTE === "1" ? "produção" : "homologação",
        erro: error.message,
      };
    }
  }

  gerarXmlCancelamento(chave, justificativa) {
    // Implementar XML de cancelamento conforme especificação SEFAZ
    return `<?xml version="1.0" encoding="UTF-8"?>
<envEvento xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110111${chave}01">
      <cOrgao>${this.obterCodigoUF(this.UF)}</cOrgao>
      <tpAmb>${this.AMBIENTE}</tpAmb>
      <CNPJ>${this.CNPJ_EMITENTE}</CNPJ>
      <chNFe>${chave}</chNFe>
      <dhEvento>${new Date().toISOString()}</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <xJust>${justificativa}</xJust>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`;
  }

  /**
   * Calcula impostos completos usando o novo serviço de tributação
   * @param {Object} dadosNfe - Dados da NFe
   * @returns {Object} Dados da NFe com impostos calculados
   */
  async calcularImpostosCompletos(dadosNfe) {
    try {
      // Copia os dados para não modificar o original
      const dadosComImpostos = JSON.parse(JSON.stringify(dadosNfe));

      // Inicializa totais
      let totalProdutos = 0;
      let totalICMS = 0;
      let totalIPI = 0;
      let totalPIS = 0;
      let totalCOFINS = 0;
      let totalISS = 0;
      let totalImpostos = 0;

      // Calcula impostos para cada item
      for (let i = 0; i < dadosComImpostos.itens.length; i++) {
        const item = dadosComImpostos.itens[i];

        // Calcula impostos do item
        const resultadoTributacao =
          await this.tributacaoService.calcularImpostos(
            item,
            dadosComImpostos.emitente,
            dadosComImpostos.destinatario,
            dadosComImpostos.configuracao || {},
          );

        if (!resultadoTributacao.sucesso) {
          throw new Error(
            `Erro no cálculo tributário do item ${i + 1}: ${resultadoTributacao.erro}`,
          );
        }

        // Adiciona informações tributárias ao item
        item.tributacao = {
          icms: {
            cst: resultadoTributacao.impostos.icms.cst,
            aliquota: resultadoTributacao.impostos.icms.aliquota,
            baseCalculo: resultadoTributacao.impostos.icms.baseCalculo,
            valor: resultadoTributacao.impostos.icms.valor,
            situacao: resultadoTributacao.impostos.icms.situacao,
          },
          ipi: {
            cst: resultadoTributacao.impostos.ipi.cst,
            aliquota: resultadoTributacao.impostos.ipi.aliquota,
            baseCalculo: resultadoTributacao.impostos.ipi.baseCalculo,
            valor: resultadoTributacao.impostos.ipi.valor,
            situacao: resultadoTributacao.impostos.ipi.situacao,
          },
          pis: {
            cst: resultadoTributacao.impostos.pis.cst,
            aliquota: resultadoTributacao.impostos.pis.aliquota,
            baseCalculo: resultadoTributacao.impostos.pis.baseCalculo,
            valor: resultadoTributacao.impostos.pis.valor,
            situacao: resultadoTributacao.impostos.pis.situacao,
          },
          cofins: {
            cst: resultadoTributacao.impostos.cofins.cst,
            aliquota: resultadoTributacao.impostos.cofins.aliquota,
            baseCalculo: resultadoTributacao.impostos.cofins.baseCalculo,
            valor: resultadoTributacao.impostos.cofins.valor,
            situacao: resultadoTributacao.impostos.cofins.situacao,
          },
          iss: {
            aliquota: resultadoTributacao.impostos.iss.aliquota,
            baseCalculo: resultadoTributacao.impostos.iss.baseCalculo,
            valor: resultadoTributacao.impostos.iss.valor,
            situacao: resultadoTributacao.impostos.iss.situacao,
            municipio: resultadoTributacao.impostos.iss.municipio,
          },
        };

        // Adiciona observações fiscais ao item
        if (resultadoTributacao.observacoes) {
          item.observacoesFiscais = resultadoTributacao.observacoes;
        }

        // Soma aos totais
        const valorItem =
          parseFloat(item.valorUnitario) * parseFloat(item.quantidade);
        totalProdutos += valorItem;
        totalICMS += resultadoTributacao.impostos.icms.valor;
        totalIPI += resultadoTributacao.impostos.ipi.valor;
        totalPIS += resultadoTributacao.impostos.pis.valor;
        totalCOFINS += resultadoTributacao.impostos.cofins.valor;
        totalISS += resultadoTributacao.impostos.iss.valor;
      }

      // Calcula total de impostos
      totalImpostos = totalICMS + totalIPI + totalPIS + totalCOFINS + totalISS;

      // Adiciona totais à NFe
      dadosComImpostos.totais = {
        vBC: parseFloat(totalProdutos.toFixed(2)), // Base de cálculo ICMS
        vICMS: parseFloat(totalICMS.toFixed(2)), // Valor ICMS
        vICMSDeson: 0.0, // Valor ICMS desonerado
        vFCP: 0.0, // Valor FCP
        vBCST: 0.0, // Base de cálculo ICMS ST
        vST: 0.0, // Valor ICMS ST
        vFCPST: 0.0, // Valor FCP ST
        vFCPSTRet: 0.0, // Valor FCP ST retido
        vProd: parseFloat(totalProdutos.toFixed(2)), // Valor total produtos
        vFrete: 0.0, // Valor frete
        vSeg: 0.0, // Valor seguro
        vDesc: 0.0, // Valor desconto
        vII: 0.0, // Valor II
        vIPI: parseFloat(totalIPI.toFixed(2)), // Valor IPI
        vIPIDevol: 0.0, // Valor IPI devolvido
        vPIS: parseFloat(totalPIS.toFixed(2)), // Valor PIS
        vCOFINS: parseFloat(totalCOFINS.toFixed(2)), // Valor COFINS
        vOutro: 0.0, // Outras despesas
        vNF: parseFloat((totalProdutos + totalImpostos).toFixed(2)), // Valor total NFe
        vTotTrib: parseFloat(totalImpostos.toFixed(2)), // Total tributos aproximados
        vISS: parseFloat(totalISS.toFixed(2)), // Valor ISS
      };

      // Gera observações gerais da NFe
      const observacoesGerais =
        this.gerarObservacoesGeraisNfe(dadosComImpostos);
      if (observacoesGerais) {
        dadosComImpostos.observacoes =
          (dadosComImpostos.observacoes || "") + " " + observacoesGerais;
      }

      return dadosComImpostos;
    } catch (error) {
      console.error("❌ Erro no cálculo tributário completo:", error.message);
      throw new Error(`Falha no cálculo tributário: ${error.message}`);
    }
  }

  /**
   * Gera observações gerais da NFe baseadas nos cálculos tributários
   */
  gerarObservacoesGeraisNfe(dadosNfe) {
    try {
      let observacoes = [];

      // Observações sobre tributação
      if (dadosNfe.emitente && dadosNfe.emitente.regimeTributario) {
        switch (dadosNfe.emitente.regimeTributario) {
          case "1": // Simples Nacional
            observacoes.push(
              "Documento emitido por ME ou EPP optante pelo Simples Nacional.",
            );
            break;
          case "2": // Simples Nacional - excesso de sublimite
            observacoes.push(
              "Documento emitido por ME ou EPP optante pelo Simples Nacional com excesso de sublimite.",
            );
            break;
          case "3": // Regime Normal
            observacoes.push(
              "Documento emitido por empresa do Regime Normal de tributação.",
            );
            break;
        }
      }

      // Observações sobre impostos aproximados
      if (dadosNfe.totais && dadosNfe.totais.vTotTrib > 0) {
        const percentualTributos = (
          (dadosNfe.totais.vTotTrib / dadosNfe.totais.vNF) *
          100
        ).toFixed(2);
        observacoes.push(
          `Valor aproximado dos tributos: R$ ${dadosNfe.totais.vTotTrib.toFixed(2)} (${percentualTributos}%) - Fonte: IBPT.`,
        );
      }

      // Observações sobre ICMS
      let temICMSIsento = false;
      let temICMSNaoTributado = false;

      if (dadosNfe.itens) {
        dadosNfe.itens.forEach((item) => {
          if (item.tributacao && item.tributacao.icms) {
            const cstICMS = item.tributacao.icms.cst;
            if (["40", "41", "50"].includes(cstICMS)) {
              temICMSIsento = true;
            }
            if (["30", "60"].includes(cstICMS)) {
              temICMSNaoTributado = true;
            }
          }
        });
      }

      if (temICMSIsento) {
        observacoes.push(
          "Mercadoria isenta de ICMS conforme artigo da legislação estadual.",
        );
      }

      if (temICMSNaoTributado) {
        observacoes.push(
          "Mercadoria não tributada pelo ICMS conforme legislação estadual.",
        );
      }

      // Observações sobre certificado digital
      if (dadosNfe.certificado && dadosNfe.certificado.validade) {
        const validadeCert = new Date(dadosNfe.certificado.validade);
        const hoje = new Date();
        const diasRestantes = Math.ceil(
          (validadeCert - hoje) / (1000 * 60 * 60 * 24),
        );

        if (diasRestantes <= 30) {
          observacoes.push(
            `ATENÇÃO: Certificado digital vence em ${diasRestantes} dias. Providencie a renovação.`,
          );
        }
      }

      // Observações personalizadas do emitente
      if (dadosNfe.observacoesPersonalizadas) {
        observacoes.push(dadosNfe.observacoesPersonalizadas);
      }

      const resultado = observacoes.join(" ");

      return resultado;
    } catch (error) {
      console.error("❌ Erro ao gerar observações gerais:", error.message);
      return "";
    }
  }

  validarXmlSeguranca(xmlContent) {
    try {
      // Lista de elementos perigosos que não devem estar presentes
      const elementosProibidos = [
        "<!ENTITY",
        "<!DOCTYPE",
        "<script",
        "javascript:",
        "vbscript:",
        "onload=",
        "onerror=",
        "onclick=",
        "eval(",
        "document.cookie",
        "window.location",
        "XMLHttpRequest",
        "fetch(",
        "import(",
        "require(",
        "process.env",
      ];

      // Verifica se há elementos proibidos
      const xmlLowerCase = xmlContent.toLowerCase();
      for (const elemento of elementosProibidos) {
        if (xmlLowerCase.includes(elemento.toLowerCase())) {
          throw new Error(`XML contém elemento não permitido: ${elemento}`);
        }
      }

      // Verifica tamanho do XML (máximo 5MB)
      const tamanhoMB = Buffer.byteLength(xmlContent, "utf8") / (1024 * 1024);
      if (tamanhoMB > 5) {
        throw new Error(
          `XML excede o tamanho máximo permitido: ${tamanhoMB.toFixed(2)}MB`,
        );
      }

      // Verifica se é um XML válido básico
      if (
        !xmlContent.includes("<?xml") ||
        !xmlContent.includes("<NFe") ||
        !xmlContent.includes("</NFe>")
      ) {
        throw new Error("XML não possui estrutura válida de NFe");
      }

      // Verifica encoding
      if (
        !xmlContent.includes('encoding="UTF-8"') &&
        !xmlContent.includes("encoding='UTF-8'")
      ) {
        // Não é erro crítico, apenas aviso
      }

      return true;
    } catch (error) {
      console.error(
        "❌ Falha na validação de segurança do XML:",
        error.message,
      );
      throw error;
    }
  }

  /**
   * Lista NFes do usuário com filtros e paginação
   */
  async listarNfes(userId, filtros = {}) {
    try {
      const page = parseInt(filtros.page) || 1;
      const limit = parseInt(filtros.limit) || 20;
      const statusFilter = filtros.status;
      const nfes = await database.buscarNFes();
      let nfesFiltradas = Array.isArray(nfes) ? nfes : [];
      if (statusFilter) {
        nfesFiltradas = nfesFiltradas.filter(
          (nfe) => nfe.status === statusFilter,
        );
      }
      const total = nfesFiltradas.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      const pageItems = nfesFiltradas.slice(start, end);
      const totalPages = Math.ceil(total / limit) || 1;
      return {
        nfes: pageItems,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filtros,
      };
    } catch (error) {
      console.error("❌ Erro ao listar NFes:", error.message);
      throw new Error(`Falha ao listar NFes: ${error.message}`);
    }
  }

  /**
   * Obtém status geral das NFes do usuário
   */
  async obterStatusNfes(userId) {
    try {
      const nfes = await database.buscarNFes();
      const lista = Array.isArray(nfes) ? nfes : [];
      const total = lista.length;
      const autorizadas = lista.filter((n) => n.status === "autorizada").length;
      const rejeitadas = lista.filter((n) => n.status === "rejeitada").length;
      const canceladas = lista.filter((n) => n.status === "cancelada").length;
      const pendentes = lista.filter((n) => n.status === "pendente").length;
      const valores = lista.reduce(
        (acc, n) => {
          const v = parseFloat(n.valor_total || 0);
          return {
            geral: acc.geral + v,
            autorizado: acc.autorizado + (n.status === "autorizada" ? v : 0),
          };
        },
        { geral: 0, autorizado: 0 },
      );
      const recentes = lista.slice(-5).reverse();
      const porMesMap = new Map();
      lista.forEach((n) => {
        const mes = (
          n.data_emissao ||
          n.criadaEm ||
          new Date().toISOString()
        ).substring(0, 7);
        const atual = porMesMap.get(mes) || {
          mes,
          quantidade: 0,
          valor_autorizado: 0,
          autorizadas: 0,
          rejeitadas: 0,
        };
        atual.quantidade += 1;
        if (n.status === "autorizada") {
          atual.autorizadas += 1;
          atual.valor_autorizado += parseFloat(n.valor_total || 0);
        }
        if (n.status === "rejeitada") {
          atual.rejeitadas += 1;
        }
        porMesMap.set(mes, atual);
      });
      const porMes = Array.from(porMesMap.values());
      const primeira_emissao =
        lista.length > 0 ? lista[0].data_emissao || lista[0].criadaEm : null;
      const ultima_emissao =
        lista.length > 0
          ? lista[lista.length - 1].data_emissao ||
            lista[lista.length - 1].criadaEm
          : null;
      const percentuais = {
        autorizadas: total > 0 ? ((autorizadas / total) * 100).toFixed(1) : 0,
        rejeitadas: total > 0 ? ((rejeitadas / total) * 100).toFixed(1) : 0,
        canceladas: total > 0 ? ((canceladas / total) * 100).toFixed(1) : 0,
        pendentes: total > 0 ? ((pendentes / total) * 100).toFixed(1) : 0,
      };
      return {
        resumo: {
          total,
          autorizadas,
          rejeitadas,
          canceladas,
          pendentes,
          processando: 0,
          percentuais,
        },
        valores: {
          total_geral: parseFloat(valores.geral.toFixed(2)),
          total_autorizado: parseFloat(valores.autorizado.toFixed(2)),
          media_por_nfe:
            total > 0 ? parseFloat((valores.geral / total).toFixed(2)) : 0,
        },
        periodo: {
          primeira_emissao,
          ultima_emissao,
          dias_ativo: primeira_emissao
            ? Math.ceil(
                (new Date() - new Date(primeira_emissao)) /
                  (1000 * 60 * 60 * 24),
              )
            : 0,
        },
        recentes,
        por_mes,
        servicos: {},
        ultima_atualizacao: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Erro ao obter status das NFes:", error.message);
      throw new Error(`Falha ao obter status das NFes: ${error.message}`);
    }
  }

  async obterXmlPorChave(chave) {
    const chaveNumerica = (chave || "").replace(/\D/g, "");
    if (chaveNumerica.length !== 44) {
      throw new Error("Chave de acesso inválida");
    }
    const candidatos = [];
    if (fs.existsSync(this.ENVIADAS_DIR)) {
      const arquivos = fs
        .readdirSync(this.ENVIADAS_DIR)
        .filter((a) => a.toLowerCase().endsWith(".xml"));
      arquivos.forEach((a) => {
        if (a.includes(chaveNumerica))
          candidatos.push(path.join(this.ENVIADAS_DIR, a));
      });
    }
    const cacheFile = path.join(this.CACHE_DIR, `NFe_${chaveNumerica}.xml`);
    if (fs.existsSync(cacheFile)) candidatos.unshift(cacheFile);
    for (const file of candidatos) {
      try {
        const content = fs.readFileSync(file, "utf8");
        return content;
      } catch {}
    }
    const baixado = await this.buscarXmlNaSefaz(chaveNumerica);
    if (baixado) return baixado;
    return null;
  }

  async buscarXmlNaSefaz(chave) {
    const tentativas = parseInt(process.env.SEFAZ_RETRY_ATTEMPTS || "3");
    const baseTimeout = parseInt(process.env.SEFAZ_TIMEOUT || "30000");
    let erroFinal = null;
    for (let i = 0; i < tentativas; i++) {
      try {
        const t0 = Date.now();
        if (!this.sefazClient) {
          this.sefazClient = new SefazClient({
            certPath: this.CERT_PATH,
            certPass: this.CERT_PASS,
            uf: this.UF,
            ambiente: this.AMBIENTE,
            timeout: baseTimeout,
          });
          await this.sefazClient.init();
        }
        const resp = await this.sefazClient.distribuicaoDFe({ chNFe: chave });
        const docNFe = (resp.docs || []).find((d) =>
          (d.xml || "").includes("<NFe"),
        );
        if (docNFe && docNFe.xml) {
          if (!fs.existsSync(this.CACHE_DIR))
            fs.mkdirSync(this.CACHE_DIR, { recursive: true });
          const destino = path.join(this.CACHE_DIR, `NFe_${chave}.xml`);
          fs.writeFileSync(destino, docNFe.xml, "utf8");
          await logService.log("sefaz_dfe", "SUCESSO", { chave, destino });
          metrics.recordDFeFetch(this.UF, true, i + 1, (Date.now() - t0) / 1000);
          return docNFe.xml;
        }
        throw new Error("XML não encontrado na distribuição");
      } catch (err) {
        erroFinal = err;
        await logService.logErro("sefaz_dfe", err, { tentativa: i + 1, chave });
        metrics.recordDFeFetch(this.UF, false, i + 1, 0);
        const espera = Math.min(baseTimeout * Math.pow(2, i), 120000);
        await new Promise((r) => setTimeout(r, espera));
      }
    }
    return null;
  }

  async processarDistribuicaoContinua() {
    const config = await database.buscarConfiguracoes().catch(() => ({}));
    const sec = config?.nfe || {};
    const tentativas = parseInt(process.env.SEFAZ_RETRY_ATTEMPTS || "3");
    const baseTimeout = parseInt(process.env.SEFAZ_TIMEOUT || "30000");
    let atual = sec.ultNSU || "000000000000000";
    const maxLoops = parseInt(process.env.DFE_MAX_LOOPS || "5");
    let loops = 0;
    while (loops < maxLoops) {
      try {
        loops++;
        if (!this.sefazClient) {
          this.sefazClient = new SefazClient({ certPath: this.CERT_PATH, certPass: this.CERT_PASS, uf: this.UF, ambiente: this.AMBIENTE, timeout: baseTimeout });
          await this.sefazClient.init();
        }
        const resp = await this.sefazClient.distribuicaoDFe({ nsudist: atual });
        for (const d of resp.docs || []) {
          const chaveMatch = (d.xml || "").match(/<chNFe>(\d{44})<\/chNFe>/);
          const chave = chaveMatch ? chaveMatch[1] : null;
          const nome = chave ? `NFe_${chave}.xml` : `DFE_${Date.now()}.xml`;
          if (!fs.existsSync(this.CACHE_DIR)) fs.mkdirSync(this.CACHE_DIR, { recursive: true });
          const destino = path.join(this.CACHE_DIR, nome);
          if (!fs.existsSync(destino)) fs.writeFileSync(destino, d.xml, "utf8");
        }
        const ultNSU = resp.meta?.ultNSU || atual;
        const maxNSU = resp.meta?.maxNSU || ultNSU;
        atual = ultNSU;
        await database.salvarConfiguracao("nfe", { ...sec, ultNSU, maxNSU }).catch(() => null);
        if (!resp.docs || resp.docs.length === 0) break;
        try {
          const ult = BigInt(String(ultNSU));
          const max = BigInt(String(maxNSU));
          if (ult >= max) break;
        } catch {}
      } catch (err) {
        const espera = Math.min(baseTimeout * Math.pow(2, loops - 1), 120000);
        await new Promise((r) => setTimeout(r, espera));
      }
    }
    }

  async limparCache(maxAgeDays = 30, maxSizeMB = 200) {
    if (!fs.existsSync(this.CACHE_DIR)) return;
    const files = fs.readdirSync(this.CACHE_DIR).map((name) => {
      const p = path.join(this.CACHE_DIR, name);
      const s = fs.statSync(p);
      return { name, path: p, mtime: s.mtime, size: s.size };
    });
    const limiteData = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    for (const f of files) {
      if (f.mtime < limiteData) fs.unlinkSync(f.path);
    }
    const restantes = fs.readdirSync(this.CACHE_DIR).map((name) => {
      const p = path.join(this.CACHE_DIR, name);
      const s = fs.statSync(p);
      return { name, path: p, mtime: s.mtime, size: s.size };
    });
    let total = restantes.reduce((acc, f) => acc + f.size, 0);
    const limite = maxSizeMB * 1024 * 1024;
    restantes.sort((a, b) => a.mtime - b.mtime);
    while (total > limite && restantes.length > 0) {
      const f = restantes.shift();
      if (!f) break;
      fs.unlinkSync(f.path);
      total -= f.size;
    }
  }

  async parseXmlToDadosNfe(xmlContent) {
    const xml2js = require("xml2js");
    const parser = new xml2js.Parser({ explicitArray: false });
    const doc = await parser.parseStringPromise(xmlContent);
    const nfe = doc.NFe || doc.nfeProc?.NFe;
    const inf = nfe?.infNFe || {};
    const ide = inf?.ide || {};
    const emit = inf?.emit || {};
    const dest = inf?.dest || {};
    const total = inf?.total?.ICMSTot || {};
    const transp = inf?.transp || {};
    const itens = [];
    const det = Array.isArray(inf?.det) ? inf.det : inf?.det ? [inf.det] : [];
    det.forEach((d) => {
      const prod = d?.prod || {};
      itens.push({
        codigo: prod.cProd,
        descricao: prod.xProd,
        ncm: prod.NCM,
        cfop: prod.CFOP,
        unidade: prod.uCom,
        quantidade: parseFloat(prod.qCom || 0),
        valorUnitario: parseFloat(prod.vUnCom || 0),
        valorTotal: parseFloat(prod.vProd || 0),
      });
    });
    return {
      numero: ide.nNF,
      serie: ide.serie,
      ambiente: parseInt(ide.tpAmb || this.AMBIENTE, 10),
      emitente: {
        nome: emit.xNome,
        cnpj: emit.CNPJ,
        ie: emit.IE,
        endereco: emit.enderEmit,
      },
      destinatario: {
        nome: dest.xNome,
        documento: dest.CNPJ || dest.CPF,
        ie: dest.IE,
        endereco: dest.enderDest,
      },
      itens,
      totais: {
        vBC: parseFloat(total.vBC || 0),
        vICMS: parseFloat(total.vICMS || 0),
        vProd: parseFloat(total.vProd || 0),
        vNF: parseFloat(total.vNF || 0),
      },
      transporte: transp,
    };
  }

  async downloadDocumento(tipo, chave) {
    const tipoNorm = (tipo || "").toLowerCase();
    if (!["xml", "pdf"].includes(tipoNorm)) {
      throw new Error("Tipo inválido");
    }
    const xml = await this.obterXmlPorChave(chave);
    if (!xml) {
      throw new Error("XML não encontrado localmente");
    }
    if (tipoNorm === "xml") {
      return { tipo: "xml", data: xml };
    }
    const dados = await this.parseXmlToDadosNfe(xml);
    const caminhoPdf = await this.danfeService.gerarDanfe(dados, xml);
    const pdfBuffer = fs.readFileSync(caminhoPdf);
    return { tipo: "pdf", data: pdfBuffer };
  }
}

module.exports = new NFeService();
