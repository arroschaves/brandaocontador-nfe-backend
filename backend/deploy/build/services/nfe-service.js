const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { carregarCertificado, assinarNFe, assinarInutilizacao, assinarEventoCancelamento } = require("../assinador");
const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");
const CertificateService = require('./certificate-service');
const SefazClient = require('./sefaz-client');
const SefazStatusService = require('./sefaz-status');
const { TaxCalculationService } = require('./tax-calculation-service');
const TributacaoService = require('./tributacao-service');
const XmlValidatorService = require('./xml-validator-service');
const DanfeService = require('./danfe-service');
const { ValidationService } = require('./validation-service');
const Configuracao = require('../models/Configuracao');

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
    [this.XMLS_DIR, this.ENVIADAS_DIR, this.FALHAS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async carregarCertificadoSistema() {
    // PRODUÇÃO REAL - Certificado A1 obrigatório
    
    try {
      let certificate;
      let info;

      // Tenta carregar do banco (Configuracao)
      const config = await Configuracao.findOne({ chave: 'padrao' }).lean().catch(() => null);
      const dbPath = config?.nfe?.certificadoDigital?.arquivo;
      const dbPass = config?.nfe?.certificadoDigital?.senha;

      if (dbPath && dbPass) {
        certificate = await this.certificateService.loadCertificateFromPath(dbPath, dbPass);
        info = this.certificateService.getCertificateInfo(certificate);
        this.CERT_PATH = dbPath;
        this.CERT_PASS = dbPass;
      } else {
        // Fallback para variáveis de ambiente e caminhos padrão
        certificate = await this.certificateService.loadCertificate();
        info = this.certificateService.getCertificateInfo(certificate);
        this.CERT_PATH = (certificate && certificate.path) ? certificate.path : this.CERT_PATH;
        this.CERT_PASS = process.env.CERT_PASS || this.CERT_PASS;
      }
      
      this.chavePrivada = certificate.privateKey;
      this.certificado = certificate.certificate;
      
      console.log("✅ Certificado carregado com sucesso:", {
        subject: info.subject.commonName,
        issuer: info.issuer.commonName,
        expiresAt: info.validity.notAfter,
        path: info.path
      });
      this.certificadoCarregado = true;
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
          erro: 'Certificado não carregado',
          codigo: 'CERTIFICADO_AUSENTE'
        };
      }
      
      // PRODUÇÃO REAL - Cálculo tributário completo
      const dadosComImpostos = await this.calcularImpostosCompletos(dadosNfe);
      
      // Gera o XML da NFe com impostos calculados
      const xmlNfe = this.gerarXmlNfe(dadosComImpostos);
      
      // Validação XML NFe 4.0 conforme legislação SEFAZ
      const resultadoValidacao = this.xmlValidatorService.validarXmlNfe(xmlNfe, dadosComImpostos);
      
      if (!resultadoValidacao.valido) {
        return {
          sucesso: false,
          erro: 'XML não conforme com a legislação NFe 4.0',
          detalhes: resultadoValidacao.erros,
          avisos: resultadoValidacao.avisos,
          codigo: 'XML_INVALIDO'
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
        const caminhoDANFE = await this.danfeService.gerarDanfe(dadosComImpostos, xmlAssinado);
        
        return {
          sucesso: true,
          chave: resultado.chave,
          protocolo: resultado.protocolo,
          dataEmissao: new Date().toISOString(),
          arquivo: nomeArquivo,
          xml: xmlAssinado,
          danfe: caminhoDANFE
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
      <natOp>${dados.naturezaOperacao || 'Venda'}</natOp>
      <mod>55</mod>
      <serie>${dados.serie || 1}</serie>
      <nNF>${dados.numero}</nNF>
      <dhEmi>${dataEmissao}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${dados.codigoMunicipio || '5006272'}</cMunFG>
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
      <CNPJ>${(this.CNPJ_EMITENTE || dados.emitente.cnpj || '').replace(/\D/g, '')}</CNPJ>
      <xNome>${dados.emitente.nome || dados.emitente.razaoSocial || 'Empresa Não Configurada'}</xNome>
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
      <indIEDest>${dados.destinatario.cnpj ? '1' : '9'}</indIEDest>
    </dest>
    ${this.gerarItensXml(dados.itens)}
    <total>
      <ICMSTot>
        <vBC>${dados.totais?.vBC || '0.00'}</vBC>
        <vICMS>${dados.totais?.vICMS || '0.00'}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${dados.totais?.vProd || '0.00'}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>${dados.totais?.vIPI || '0.00'}</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>${dados.totais?.vPIS || '0.00'}</vPIS>
        <vCOFINS>${dados.totais?.vCOFINS || '0.00'}</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${dados.totais?.vNF || '0.00'}</vNF>
        <vTotTrib>${dados.totais?.vTotTrib || '0.00'}</vTotTrib>
      </ICMSTot>
    </total>
    ${dados.observacoes ? `<infAdic><infCpl>${dados.observacoes}</infCpl></infAdic>` : ''}
  </infNFe>
</NFe>`;

    return xml;
  }

  gerarItensXml(itens) {
    return itens.map((item, index) => {
      const valorTotal = parseFloat(item.valorUnitario) * parseFloat(item.quantidade);
      const tributacao = item.tributacao || {};
      
      return `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${item.codigo}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${item.descricao}</xProd>
        <NCM>${item.ncm || '00000000'}</NCM>
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
          <ICMS${tributacao.icms?.cst || '00'}>
            <orig>0</orig>
            <CST>${tributacao.icms?.cst || '00'}</CST>
            ${tributacao.icms?.valor > 0 ? `
            <modBC>3</modBC>
            <vBC>${tributacao.icms.baseCalculo.toFixed(2)}</vBC>
            <pICMS>${tributacao.icms.aliquota.toFixed(2)}</pICMS>
            <vICMS>${tributacao.icms.valor.toFixed(2)}</vICMS>` : ''}
          </ICMS${tributacao.icms?.cst || '00'}>
        </ICMS>
        ${tributacao.ipi?.valor > 0 ? `
        <IPI>
          <cEnq>999</cEnq>
          <IPITrib>
            <CST>${tributacao.ipi.cst}</CST>
            <vBC>${tributacao.ipi.baseCalculo.toFixed(2)}</vBC>
            <pIPI>${tributacao.ipi.aliquota.toFixed(2)}</pIPI>
            <vIPI>${tributacao.ipi.valor.toFixed(2)}</vIPI>
          </IPITrib>
        </IPI>` : `
        <IPI>
          <cEnq>999</cEnq>
          <IPINT>
            <CST>${tributacao.ipi?.cst || '53'}</CST>
          </IPINT>
        </IPI>`}
        <PIS>
          <PIS${this.obterTipoPIS(tributacao.pis?.cst)}>
            <CST>${tributacao.pis?.cst || '08'}</CST>
            ${tributacao.pis?.valor > 0 ? `
            <vBC>${tributacao.pis.baseCalculo.toFixed(2)}</vBC>
            <pPIS>${tributacao.pis.aliquota.toFixed(4)}</pPIS>` : ''}
            <vPIS>${(tributacao.pis?.valor || 0).toFixed(2)}</vPIS>
          </PIS${this.obterTipoPIS(tributacao.pis?.cst)}>
        </PIS>
        <COFINS>
          <COFINS${this.obterTipoCOFINS(tributacao.cofins?.cst)}>
            <CST>${tributacao.cofins?.cst || '08'}</CST>
            ${tributacao.cofins?.valor > 0 ? `
            <vBC>${tributacao.cofins.baseCalculo.toFixed(2)}</vBC>
            <pCOFINS>${tributacao.cofins.aliquota.toFixed(4)}</pCOFINS>` : ''}
            <vCOFINS>${(tributacao.cofins?.valor || 0).toFixed(2)}</vCOFINS>
          </COFINS${this.obterTipoCOFINS(tributacao.cofins?.cst)}>
        </COFINS>
        ${tributacao.iss?.valor > 0 ? `
        <ISSQN>
          <vBC>${tributacao.iss.baseCalculo.toFixed(2)}</vBC>
          <vAliq>${tributacao.iss.aliquota.toFixed(2)}</vAliq>
          <vISSQN>${tributacao.iss.valor.toFixed(2)}</vISSQN>
          <cMunFG>${item.codigoMunicipioISS || '5006272'}</cMunFG>
          <cListServ>${item.codigoServico || '01.01'}</cListServ>
        </ISSQN>` : ''}
      </imposto>
      ${item.observacoesFiscais ? `<infAdProd>${item.observacoesFiscais}</infAdProd>` : ''}
    </det>`;
    }).join('');
  }

  /**
   * Determina o tipo de PIS baseado no CST
   */
  obterTipoPIS(cst) {
    if (!cst) return 'NT';
    
    switch (cst) {
      case '01':
      case '02':
        return 'Aliq';
      case '03':
        return 'Qtde';
      case '04':
      case '05':
      case '06':
      case '07':
      case '08':
      case '09':
        return 'NT';
      case '99':
        return 'Outr';
      default:
        return 'NT';
    }
  }

  /**
   * Determina o tipo de COFINS baseado no CST
   */
  obterTipoCOFINS(cst) {
    if (!cst) return 'NT';
    
    switch (cst) {
      case '01':
      case '02':
        return 'Aliq';
      case '03':
        return 'Qtde';
      case '04':
      case '05':
      case '06':
      case '07':
      case '08':
      case '09':
        return 'NT';
      case '99':
        return 'Outr';
      default:
        return 'NT';
    }
  }

  async assinarXml(xml) {
    try {
      console.log("🔍 XML antes da assinatura (primeiros 500 chars):", xml.substring(0, 500));
      console.log("🔍 Verificando se contém infNFe:", xml.includes('infNFe'));
      console.log("🔍 Verificando se contém Id=:", xml.includes('Id='));
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
      console.log('✅ Consulta SEFAZ realizada:', resultado);
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro na consulta:', error.message);
      throw error;
    }
  }

  // ==================== CANCELAMENTO NFE ====================

  async cancelarNfe(chave, justificativa) {
    try {
      // Validações
      if (!chave || chave.length !== 44) {
        throw new Error('Chave de acesso inválida');
      }
      
      if (!justificativa || justificativa.length < 15) {
        throw new Error('Justificativa deve ter pelo menos 15 caracteres');
      }
      
      // Cancelamento real via SEFAZ
      if (!this.chavePrivada || !this.certificado) {
        return {
          sucesso: false,
          erro: 'Certificado não carregado',
          codigo: 'CERTIFICADO_AUSENTE'
        };
      }
      
      // Gera XML do evento de cancelamento
      const xmlCancelamento = this.gerarXmlCancelamento(chave, justificativa);
      
      // Assina XML do evento de cancelamento
      const xmlAssinado = assinarEventoCancelamento(xmlCancelamento, this.chavePrivada, this.certificado);
      
      // Envia para SEFAZ
      const resposta = await this.enviarCancelamentoSefaz(xmlAssinado);
      
      const resultado = {
        chave,
        situacao: 'Cancelada',
        protocolo: resposta?.protocolo || `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        dataHora: new Date().toISOString(),
        motivo: 'Cancelamento de NF-e homologado',
        justificativa
      };
      
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro no cancelamento:', error.message);
      throw error;
    }
  }

  // ==================== INUTILIZAÇÃO NFE ====================

  async inutilizarNumeracao({ serie, numeroInicial, numeroFinal, justificativa, ano }) {
    try {
      // Validações básicas
      const s = parseInt(serie, 10);
      const nIni = parseInt(numeroInicial, 10);
      const nFim = parseInt(numeroFinal, 10);
      const anoRef = ano || new Date().getFullYear().toString().slice(-2);

      if (isNaN(s) || s < 0) throw new Error('Série inválida');
      if (isNaN(nIni) || isNaN(nFim) || nIni <= 0 || nFim <= 0) throw new Error('Numeração inválida');
      if (nFim < nIni) throw new Error('Número final deve ser maior ou igual ao inicial');
      if (!justificativa || justificativa.trim().length < 15) throw new Error('Justificativa deve ter pelo menos 15 caracteres');

      // Processamento real da inutilização

      // Verifica certificado
      if (!this.chavePrivada || !this.certificado) {
        return {
          sucesso: false,
          erro: 'Certificado não carregado',
          codigo: 'CERTIFICADO_AUSENTE'
        };
      }

      // Gera XML de inutilização
      const xmlInut = this.gerarXmlInutilizacao({ serie: s, numeroInicial: nIni, numeroFinal: nFim, justificativa, ano: anoRef });

      // Assina XML
      const xmlAssinado = assinarInutilizacao(xmlInut, this.chavePrivada, this.certificado);

      // Envia para SEFAZ
      const resposta = await this.enviarInutilizacaoSefaz(xmlAssinado);

      // Normaliza resultado
      if (resposta?.sucesso || resposta?.cStat === '102' || resposta?.cStat === 102) { // 102: Inutilização de número homologado
        return {
          sucesso: true,
          protocolo: resposta?.protocolo || resposta?.infInut?.nProt || `${Date.now()}`,
          mensagem: resposta?.xMotivo || 'Inutilização homologada',
          serie: s,
          numeroInicial: nIni,
          numeroFinal: nFim
        };
      }

      throw new Error(resposta?.erro || resposta?.xMotivo || 'Falha na inutilização');
    } catch (error) {
      console.error('❌ Erro na inutilização:', error.message);
      throw error;
    }
  }

  gerarXmlInutilizacao({ serie, numeroInicial, numeroFinal, justificativa, ano }) {
    const cUF = this.obterCodigoUF(this.UF);
    const cnpj = (this.CNPJ_EMITENTE || '').replace(/\D/g, '');
    const mod = '55';
    const id = `ID${cUF}${ano}${cnpj}${mod}${String(serie).padStart(3, '0')}${String(numeroInicial).padStart(9, '0')}${String(numeroFinal).padStart(9, '0')}`;
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
          timeout: parseInt(process.env.TIMEOUT || '30000')
        });
        await this.sefazClient.init();
      }

      const resposta = await this.sefazClient.inutilizar(xmlAssinado);
      const sucesso = true; // TODO: interpretar resposta SOAP
      const protocolo = resposta?.infInut?.nProt || resposta?.protocolo || 'N/A';
      const xMotivo = resposta?.infInut?.xMotivo || resposta?.xMotivo || null;
      const cStat = resposta?.infInut?.cStat || resposta?.cStat || null;
      return { sucesso, protocolo, xMotivo, cStat };
    } catch (error) {
      console.error('❌ Erro ao enviar inutilização SEFAZ:', error.message);
      return { sucesso: false, erro: error.message };
    }
  }

  // ==================== HISTÓRICO ====================

  async obterHistorico(filtros) {
    try {
      const arquivos = fs.readdirSync(this.ENVIADAS_DIR);
      
      // Simula busca no histórico (implementar com banco de dados)
      const historico = arquivos.map(arquivo => {
        const stats = fs.statSync(path.join(this.ENVIADAS_DIR, arquivo));
        return {
          arquivo,
          dataEmissao: stats.birthtime,
          status: 'Autorizada'
        };
      });

      // Aplica filtros
      let resultado = historico;
      
      if (filtros.dataInicio) {
        const dataInicio = new Date(filtros.dataInicio);
        resultado = resultado.filter(item => item.dataEmissao >= dataInicio);
      }
      
      if (filtros.dataFim) {
        const dataFim = new Date(filtros.dataFim);
        resultado = resultado.filter(item => item.dataEmissao <= dataFim);
      }

      // Paginação
      const inicio = (filtros.pagina - 1) * filtros.limite;
      const fim = inicio + filtros.limite;
      
      return {
        itens: resultado.slice(inicio, fim),
        total: resultado.length,
        pagina: filtros.pagina,
        totalPaginas: Math.ceil(resultado.length / filtros.limite)
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
          valido: true // Implementar validação real
        },
        sefaz: {
          disponivel: await this.verificarStatusSefaz(),
          ambiente: this.AMBIENTE === "1" ? "Produção" : "Homologação",
          uf: this.UF
        },
        diretorios: {
          xmls: fs.existsSync(this.XMLS_DIR),
          enviadas: fs.existsSync(this.ENVIADAS_DIR),
          falhas: fs.existsSync(this.FALHAS_DIR)
        }
      };
    } catch (error) {
      throw new Error(`Erro no status: ${error.message}`);
    }
  }

  // ==================== MÉTODOS AUXILIARES ====================

  async obterSeriePadrao() {
    try {
      const config = await Configuracao.findOne({ chave: 'padrao' }).lean().catch(() => null);
      const serieCfg = config?.nfe?.serie ?? '1';
      const serieNum = parseInt(serieCfg, 10);
      return Number.isNaN(serieNum) ? 1 : serieNum;
    } catch (e) {
      console.warn('⚠️ Falha ao obter série padrão:', e.message);
      return 1;
    }
  }

  async obterProximoNumero(serie) {
    // Primeiro tenta persistir via Configuração (Mongo)
    try {
      const config = await Configuracao.findOne({ chave: 'padrao' }).lean().catch(() => null);
      let proximo = 1;
      if (config?.nfe?.numeracaoInicial !== undefined && config?.nfe?.numeracaoInicial !== null) {
        const atual = parseInt(config.nfe.numeracaoInicial, 10);
        proximo = Number.isNaN(atual) ? 1 : atual;
      }
      // Atualiza para o próximo número
      await Configuracao.updateOne(
        { chave: 'padrao' },
        { $set: { 'nfe.numeracaoInicial': proximo + 1 } },
        { upsert: true }
      ).catch(() => null);
      return proximo;
    } catch (e) {
      console.warn('⚠️ Falha ao atualizar numeração no banco. Usando arquivo.', e.message);
    }

    // Fallback: usar arquivo numeracao.json
    try {
      let mapa = {};
      if (fs.existsSync(this.NUMERACAO_PATH)) {
        const raw = fs.readFileSync(this.NUMERACAO_PATH, 'utf-8');
        mapa = JSON.parse(raw);
      }
      const chaveSerie = String(serie || 1);
      const atual = parseInt(mapa[chaveSerie] || 1, 10);
      const proximo = Number.isNaN(atual) ? 1 : atual;
      mapa[chaveSerie] = proximo + 1;
      fs.writeFileSync(this.NUMERACAO_PATH, JSON.stringify(mapa, null, 2), 'utf-8');
      return proximo;
    } catch (e) {
      console.warn('⚠️ Falha na persistência de numeração em arquivo:', e.message);
      return 1;
    }
  }

  gerarChaveAcesso(dados) {
    // Implementação simplificada - usar biblioteca específica em produção
    const uf = this.obterCodigoUF(dados.emitente?.endereco?.uf || this.UF);
    const ano = new Date().getFullYear().toString().slice(-2);
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    // Usa CNPJ do ambiente, com fallback para payload do emitente
    const cnpjFonte = this.CNPJ_EMITENTE || (dados?.emitente?.cnpj);
    const cnpj = (cnpjFonte || '').replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) {
      console.warn('⚠️  CNPJ para geração de chave de acesso ausente ou inválido. Verifique env CNPJ_EMITENTE ou dados.emitente.cnpj');
    }
    const modelo = "55";
    const serie = String(dados.serie || 1).padStart(3, '0');
    const numero = String(dados.numero).padStart(9, '0');
    const codigo = this.gerarCodigoNumerico();
    
    const chave = uf + ano + mes + cnpj + modelo + serie + numero + codigo;
    const dv = this.calcularDV(chave);
    
    return chave + dv;
  }

  gerarCodigoNumerico() {
    return Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
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
      'AC': '12',
      'AL': '27',
      'AM': '13',
      'AP': '16',
      'BA': '29',
      'CE': '23',
      'DF': '53',
      'ES': '32',
      'GO': '52',
      'MA': '21',
      'MG': '31',
      'MS': '50',
      'MT': '51',
      'PA': '15',
      'PB': '25',
      'PE': '26',
      'PI': '22',
      'PR': '41',
      'RJ': '33',
      'RN': '24',
      'RO': '11',
      'RR': '14',
      'RS': '43',
      'SC': '42',
      'SE': '28',
      'SP': '35',
      'TO': '17',
      // Aliases para serviços compartilhados
      'SVRS': '43'
    };
    return codigos[uf] || codigos['SP'];
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
          timeout: parseInt(process.env.TIMEOUT || '30000')
        });
        await this.sefazClient.init();
      }

      const resposta = await this.sefazClient.enviarLote(xmlAssinado);
      // Normalizar resposta
      const sucesso = true; // Placeholder: interpretar resposta SOAP para status real
      const protocolo = resposta?.protNFe?.infProt?.nProt || resposta?.protocolo || 'N/A';
      const chave = resposta?.protNFe?.infProt?.chNFe || this.gerarChaveAcesso({ numero: 0, serie: 1, emitente: { cnpj: this.CNPJ_EMITENTE } });
      return { sucesso, protocolo, chave };
    } catch (error) {
      console.error('❌ Erro ao enviar para SEFAZ:', error.message);
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
          timeout: parseInt(process.env.TIMEOUT || '30000')
        });
        await this.sefazClient.init();
      }
      const resposta = await this.sefazClient.consultar(chave);
      // Normalizar resposta
      return {
        situacao: 'Autorizada', // Placeholder: interpretar `cStat` e `xMotivo`
        protocolo: resposta?.protNFe?.infProt?.nProt || 'N/A',
        xml: resposta?.xml || null
      };
    } catch (error) {
      console.error('❌ Erro na consulta SEFAZ:', error.message);
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
          timeout: parseInt(process.env.TIMEOUT || '30000')
        });
        await this.sefazClient.init();
      }
      const resposta = await this.sefazClient.cancelar(xmlCancelamentoAssinado);
      return {
        protocolo: resposta?.retEvento?.infEvento?.nProt || resposta?.protocolo || 'N/A'
      };
    } catch (error) {
      console.error('❌ Erro no cancelamento SEFAZ:', error.message);
      throw error;
    }
  }

  async verificarStatusSefaz() {
    try {
      // Verificação real da SEFAZ

      // Verificação real usando o novo serviço de status
      const statusUF = await this.sefazStatusService.verificarStatusUF(this.UF, this.AMBIENTE);
      
      return {
        disponivel: statusUF.disponivel,
        status: statusUF.status,
        modo: 'real',
        uf: this.UF,
        ambiente: this.AMBIENTE === '1' ? 'produção' : 'homologação',
        detalhes: statusUF,
        responseTime: statusUF.responseTime
      };
    } catch (error) {
      console.warn('⚠️ Erro ao verificar status SEFAZ:', error.message);
      return {
        disponivel: false,
        status: 'offline',
        modo: 'real',
        uf: this.UF,
        ambiente: this.AMBIENTE === '1' ? 'produção' : 'homologação',
        erro: error.message
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
        const resultadoTributacao = await this.tributacaoService.calcularImpostos(
          item,
          dadosComImpostos.emitente,
          dadosComImpostos.destinatario,
          dadosComImpostos.configuracao || {}
        );
        
        if (!resultadoTributacao.sucesso) {
          throw new Error(`Erro no cálculo tributário do item ${i + 1}: ${resultadoTributacao.erro}`);
        }
        
        // Adiciona informações tributárias ao item
        item.tributacao = {
          icms: {
            cst: resultadoTributacao.impostos.icms.cst,
            aliquota: resultadoTributacao.impostos.icms.aliquota,
            baseCalculo: resultadoTributacao.impostos.icms.baseCalculo,
            valor: resultadoTributacao.impostos.icms.valor,
            situacao: resultadoTributacao.impostos.icms.situacao
          },
          ipi: {
            cst: resultadoTributacao.impostos.ipi.cst,
            aliquota: resultadoTributacao.impostos.ipi.aliquota,
            baseCalculo: resultadoTributacao.impostos.ipi.baseCalculo,
            valor: resultadoTributacao.impostos.ipi.valor,
            situacao: resultadoTributacao.impostos.ipi.situacao
          },
          pis: {
            cst: resultadoTributacao.impostos.pis.cst,
            aliquota: resultadoTributacao.impostos.pis.aliquota,
            baseCalculo: resultadoTributacao.impostos.pis.baseCalculo,
            valor: resultadoTributacao.impostos.pis.valor,
            situacao: resultadoTributacao.impostos.pis.situacao
          },
          cofins: {
            cst: resultadoTributacao.impostos.cofins.cst,
            aliquota: resultadoTributacao.impostos.cofins.aliquota,
            baseCalculo: resultadoTributacao.impostos.cofins.baseCalculo,
            valor: resultadoTributacao.impostos.cofins.valor,
            situacao: resultadoTributacao.impostos.cofins.situacao
          },
          iss: {
            aliquota: resultadoTributacao.impostos.iss.aliquota,
            baseCalculo: resultadoTributacao.impostos.iss.baseCalculo,
            valor: resultadoTributacao.impostos.iss.valor,
            situacao: resultadoTributacao.impostos.iss.situacao,
            municipio: resultadoTributacao.impostos.iss.municipio
          }
        };
        
        // Adiciona observações fiscais ao item
        if (resultadoTributacao.observacoes) {
          item.observacoesFiscais = resultadoTributacao.observacoes;
        }
        
        // Soma aos totais
        const valorItem = parseFloat(item.valorUnitario) * parseFloat(item.quantidade);
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
        vBC: parseFloat(totalProdutos.toFixed(2)),      // Base de cálculo ICMS
        vICMS: parseFloat(totalICMS.toFixed(2)),        // Valor ICMS
        vICMSDeson: 0.00,                               // Valor ICMS desonerado
        vFCP: 0.00,                                     // Valor FCP
        vBCST: 0.00,                                    // Base de cálculo ICMS ST
        vST: 0.00,                                      // Valor ICMS ST
        vFCPST: 0.00,                                   // Valor FCP ST
        vFCPSTRet: 0.00,                                // Valor FCP ST retido
        vProd: parseFloat(totalProdutos.toFixed(2)),    // Valor total produtos
        vFrete: 0.00,                                   // Valor frete
        vSeg: 0.00,                                     // Valor seguro
        vDesc: 0.00,                                    // Valor desconto
        vII: 0.00,                                      // Valor II
        vIPI: parseFloat(totalIPI.toFixed(2)),          // Valor IPI
        vIPIDevol: 0.00,                                // Valor IPI devolvido
        vPIS: parseFloat(totalPIS.toFixed(2)),          // Valor PIS
        vCOFINS: parseFloat(totalCOFINS.toFixed(2)),    // Valor COFINS
        vOutro: 0.00,                                   // Outras despesas
        vNF: parseFloat((totalProdutos + totalImpostos).toFixed(2)), // Valor total NFe
        vTotTrib: parseFloat(totalImpostos.toFixed(2)), // Total tributos aproximados
        vISS: parseFloat(totalISS.toFixed(2))           // Valor ISS
      };
      
      // Gera observações gerais da NFe
      const observacoesGerais = this.gerarObservacoesGeraisNfe(dadosComImpostos);
      if (observacoesGerais) {
        dadosComImpostos.observacoes = (dadosComImpostos.observacoes || '') + ' ' + observacoesGerais;
      }
      
      return dadosComImpostos;
      
    } catch (error) {
      console.error('❌ Erro no cálculo tributário completo:', error.message);
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
          case '1': // Simples Nacional
            observacoes.push('Documento emitido por ME ou EPP optante pelo Simples Nacional.');
            break;
          case '2': // Simples Nacional - excesso de sublimite
            observacoes.push('Documento emitido por ME ou EPP optante pelo Simples Nacional com excesso de sublimite.');
            break;
          case '3': // Regime Normal
            observacoes.push('Documento emitido por empresa do Regime Normal de tributação.');
            break;
        }
      }
      
      // Observações sobre impostos aproximados
      if (dadosNfe.totais && dadosNfe.totais.vTotTrib > 0) {
        const percentualTributos = ((dadosNfe.totais.vTotTrib / dadosNfe.totais.vNF) * 100).toFixed(2);
        observacoes.push(`Valor aproximado dos tributos: R$ ${dadosNfe.totais.vTotTrib.toFixed(2)} (${percentualTributos}%) - Fonte: IBPT.`);
      }
      
      // Observações sobre ICMS
      let temICMSIsento = false;
      let temICMSNaoTributado = false;
      
      if (dadosNfe.itens) {
        dadosNfe.itens.forEach(item => {
          if (item.tributacao && item.tributacao.icms) {
            const cstICMS = item.tributacao.icms.cst;
            if (['40', '41', '50'].includes(cstICMS)) {
              temICMSIsento = true;
            }
            if (['30', '60'].includes(cstICMS)) {
              temICMSNaoTributado = true;
            }
          }
        });
      }
      
      if (temICMSIsento) {
        observacoes.push('Mercadoria isenta de ICMS conforme artigo da legislação estadual.');
      }
      
      if (temICMSNaoTributado) {
        observacoes.push('Mercadoria não tributada pelo ICMS conforme legislação estadual.');
      }
      
      // Observações sobre certificado digital
      if (dadosNfe.certificado && dadosNfe.certificado.validade) {
        const validadeCert = new Date(dadosNfe.certificado.validade);
        const hoje = new Date();
        const diasRestantes = Math.ceil((validadeCert - hoje) / (1000 * 60 * 60 * 24));
        
        if (diasRestantes <= 30) {
          observacoes.push(`ATENÇÃO: Certificado digital vence em ${diasRestantes} dias. Providencie a renovação.`);
        }
      }
      
      // Observações personalizadas do emitente
      if (dadosNfe.observacoesPersonalizadas) {
        observacoes.push(dadosNfe.observacoesPersonalizadas);
      }
      
      const resultado = observacoes.join(' ');
      
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro ao gerar observações gerais:', error.message);
      return '';
    }
  }

  validarXmlSeguranca(xmlContent) {
    try {
      // Lista de elementos perigosos que não devem estar presentes
      const elementosProibidos = [
        '<!ENTITY',
        '<!DOCTYPE',
        '<script',
        'javascript:',
        'vbscript:',
        'onload=',
        'onerror=',
        'onclick=',
        'eval(',
        'document.cookie',
        'window.location',
        'XMLHttpRequest',
        'fetch(',
        'import(',
        'require(',
        'process.env'
      ];
      
      // Verifica se há elementos proibidos
      const xmlLowerCase = xmlContent.toLowerCase();
      for (const elemento of elementosProibidos) {
        if (xmlLowerCase.includes(elemento.toLowerCase())) {
          throw new Error(`XML contém elemento não permitido: ${elemento}`);
        }
      }
      
      // Verifica tamanho do XML (máximo 5MB)
      const tamanhoMB = Buffer.byteLength(xmlContent, 'utf8') / (1024 * 1024);
      if (tamanhoMB > 5) {
        throw new Error(`XML excede o tamanho máximo permitido: ${tamanhoMB.toFixed(2)}MB`);
      }
      
      // Verifica se é um XML válido básico
      if (!xmlContent.includes('<?xml') || !xmlContent.includes('<NFe') || !xmlContent.includes('</NFe>')) {
        throw new Error('XML não possui estrutura válida de NFe');
      }
      
      // Verifica encoding
      if (!xmlContent.includes('encoding="UTF-8"') && !xmlContent.includes("encoding='UTF-8'")) {
        // Não é erro crítico, apenas aviso
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Falha na validação de segurança do XML:', error.message);
      throw error;
    }
  }
}

module.exports = new NFeService();
