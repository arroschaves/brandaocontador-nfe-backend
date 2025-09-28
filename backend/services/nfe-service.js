const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { carregarCertificado, assinarNFe } = require("../assinador");
const { DOMParser, XMLSerializer } = require("xmldom");

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

  carregarCertificadoSistema() {
    try {
      if (!this.CERT_PATH) {
        throw new Error("Caminho do certificado não configurado");
      }

      const certData = carregarCertificado(this.CERT_PATH, this.CERT_PASS);
      this.chavePrivada = certData.chavePrivada;
      this.certificado = certData.certificado;
      
      console.log("✅ Certificado carregado com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar certificado:", error.message);
      this.certificadoCarregado = false;
    }
  }

  // ==================== EMISSÃO DE NFE ====================

  async emitirNfe(dadosNfe) {
    try {
      if (!this.chavePrivada || !this.certificado) {
        throw new Error("Certificado não carregado");
      }

      // Gera o XML da NFe
      const xmlNfe = this.gerarXmlNfe(dadosNfe);
      
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
        
        return {
          sucesso: true,
          chave: resultado.chave,
          protocolo: resultado.protocolo,
          dataEmissao: new Date().toISOString(),
          arquivo: nomeArquivo,
          xml: xmlAssinado
        };
      } else {
        const caminhoFalha = path.join(this.FALHAS_DIR, nomeArquivo);
        fs.renameSync(caminhoXml, caminhoFalha);
        
        throw new Error(`Erro SEFAZ: ${resultado.erro}`);
      }

    } catch (error) {
      console.error("Erro na emissão:", error);
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
      <cUF>${this.obterCodigoUF(this.UF)}</cUF>
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
      <CNPJ>${this.CNPJ_EMITENTE}</CNPJ>
      <xNome>${dados.emitente.nome}</xNome>
      <enderEmit>
        <xLgr>${dados.emitente.endereco.logradouro}</xLgr>
        <nro>${dados.emitente.endereco.numero}</nro>
        <xBairro>${dados.emitente.endereco.bairro}</xBairro>
        <cMun>${dados.emitente.endereco.codigoMunicipio}</cMun>
        <xMun>${dados.emitente.endereco.municipio}</xMun>
        <UF>${this.UF}</UF>
        <CEP>${dados.emitente.endereco.cep}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderEmit>
      <IE>${dados.emitente.inscricaoEstadual}</IE>
      <CRT>${dados.emitente.regimeTributario || 3}</CRT>
    </emit>
    <dest>
      <CNPJ>${dados.destinatario.cnpj}</CNPJ>
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
      <indIEDest>1</indIEDest>
    </dest>
    ${this.gerarItensXml(dados.itens)}
    <total>
      <ICMSTot>
        <vBC>${dados.totais.baseCalculoICMS}</vBC>
        <vICMS>${dados.totais.valorICMS}</vICMS>
        <vProd>${dados.totais.valorProdutos}</vProd>
        <vNF>${dados.totais.valorTotal}</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;

    return xml;
  }

  gerarItensXml(itens) {
    return itens.map((item, index) => `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${item.codigo}</cProd>
        <xProd>${item.descricao}</xProd>
        <CFOP>${item.cfop}</CFOP>
        <uCom>${item.unidade}</uCom>
        <qCom>${item.quantidade}</qCom>
        <vUnCom>${item.valorUnitario}</vUnCom>
        <vProd>${item.valorTotal}</vProd>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>${item.baseCalculoICMS}</vBC>
            <pICMS>${item.aliquotaICMS}</pICMS>
            <vICMS>${item.valorICMS}</vICMS>
          </ICMS00>
        </ICMS>
      </imposto>
    </det>`).join('');
  }

  async assinarXml(xml) {
    try {
      return await assinarNFe(xml, this.chavePrivada, this.certificado);
    } catch (error) {
      throw new Error(`Erro na assinatura: ${error.message}`);
    }
  }

  // ==================== CONSULTA NFE ====================

  async consultarNfe(chave) {
    try {
      // Simula consulta à SEFAZ (implementar integração real)
      const resultado = await this.consultarSefaz(chave);
      
      return {
        chave,
        situacao: resultado.situacao,
        protocolo: resultado.protocolo,
        dataConsulta: new Date().toISOString(),
        xml: resultado.xml
      };
    } catch (error) {
      throw new Error(`Erro na consulta: ${error.message}`);
    }
  }

  // ==================== CANCELAMENTO NFE ====================

  async cancelarNfe(chave, justificativa) {
    try {
      // Gera XML de cancelamento
      const xmlCancelamento = this.gerarXmlCancelamento(chave, justificativa);
      
      // Assina o XML de cancelamento
      const xmlAssinado = await this.assinarXml(xmlCancelamento);
      
      // Envia para SEFAZ
      const resultado = await this.enviarCancelamentoSefaz(xmlAssinado);
      
      return {
        chave,
        protocolo: resultado.protocolo,
        dataCancelamento: new Date().toISOString(),
        justificativa
      };
    } catch (error) {
      throw new Error(`Erro no cancelamento: ${error.message}`);
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
          ambiente: this.AMBIENTE === "1" ? "Produção" : "Homologação"
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

  gerarChaveAcesso(dados) {
    // Implementação simplificada - usar biblioteca específica em produção
    const uf = this.obterCodigoUF(this.UF);
    const ano = new Date().getFullYear().toString().slice(-2);
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const cnpj = this.CNPJ_EMITENTE.replace(/\D/g, '');
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
      'MS': '28',
      'SP': '35',
      'RJ': '33',
      'MG': '31'
      // Adicionar outros estados conforme necessário
    };
    return codigos[uf] || '28';
  }

  // ==================== INTEGRAÇÃO SEFAZ (SIMULADA) ====================

  async enviarParaSefaz(xml) {
    // Simula envio para SEFAZ - implementar integração real
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          sucesso: true,
          chave: "28240945669746000120550010000000011123456789",
          protocolo: "128240000000001"
        });
      }, 1000);
    });
  }

  async consultarSefaz(chave) {
    // Simula consulta SEFAZ - implementar integração real
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          situacao: "Autorizada",
          protocolo: "128240000000001",
          xml: "<xml>...</xml>"
        });
      }, 500);
    });
  }

  async enviarCancelamentoSefaz(xml) {
    // Simula cancelamento SEFAZ - implementar integração real
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          protocolo: "128240000000002"
        });
      }, 1000);
    });
  }

  async verificarStatusSefaz() {
    // Simula verificação status SEFAZ - implementar integração real
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 200);
    });
  }

  gerarXmlCancelamento(chave, justificativa) {
    // Implementar XML de cancelamento conforme especificação SEFAZ
    return `<?xml version="1.0" encoding="UTF-8"?>
<envEvento xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110111${chave}01">
      <cOrgao>28</cOrgao>
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
}

module.exports = new NFeService();