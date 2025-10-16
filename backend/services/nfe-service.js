const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { carregarCertificado, assinarNFe } = require("../assinador");
const { DOMParser, XMLSerializer } = require("xmldom");
const CertificateService = require('./certificate-service');
const SefazClient = require('./sefaz-client');
const { EmissorNFeAxios } = require('../emit-nfe-axios');

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
    
    this.certificateService = new CertificateService();
    
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
    // Se estiver em modo simulação, pula carregamento de certificado
    if (process.env.SIMULATION_MODE === 'true') {
      console.log('🔧 Modo simulação ativado - certificado não obrigatório');
      this.certificadoCarregado = true;
      return;
    }
    
    try {
      const certificate = await this.certificateService.loadCertificate();
      const info = this.certificateService.getCertificateInfo(certificate);
      
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
      console.log('📄 Iniciando emissão de NFe...');
      console.log('📋 Dados recebidos:', JSON.stringify(dadosNfe, null, 2));
      
      // Se estiver em modo simulação
      if (process.env.SIMULATION_MODE === 'true') {
        const chaveAcesso = this.gerarChaveAcesso(dadosNfe);
        const resultado = {
          sucesso: true,
          chave: chaveAcesso,
          protocolo: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
          dataEmissao: new Date().toISOString(),
          mensagem: 'NFe autorizada (simulação)',
          xml: this.gerarXmlNfe(dadosNfe)
        };
        
        console.log('✅ NFe emitida com sucesso (simulação)!');
        return resultado;
      }
      
      if (!this.chavePrivada || !this.certificado) {
        console.log('❌ Certificado não carregado');
        // Retorna erro estruturado para permitir resposta 400 na rota
        return {
          sucesso: false,
          erro: 'Certificado não carregado',
          codigo: 'CERTIFICADO_AUSENTE'
        };
      }

      console.log('🔐 Certificado carregado, gerando XML...');
      // Gera o XML da NFe
      const xmlNfe = this.gerarXmlNfe(dadosNfe);
      console.log('📄 XML gerado com sucesso');
      
      // Assina o XML
      console.log('🔐 Assinando XML...');
      const xmlAssinado = await this.assinarXml(xmlNfe);
      console.log('✅ XML assinado com sucesso');

      // Validação XML security (temporariamente desabilitada para debug)
      // validarXmlSeguranca.call(this, xmlNfe);
      
      // Salva XML antes do envio
      console.log('💾 Salvando XML...');
      const nomeArquivo = `NFe_${dadosNfe.numero}_${Date.now()}.xml`;
      const caminhoXml = path.join(this.XMLS_DIR, nomeArquivo);
      fs.writeFileSync(caminhoXml, xmlAssinado, "utf-8");
      console.log('✅ XML salvo:', caminhoXml);
      
      // Envia para SEFAZ
      console.log('📤 Enviando para SEFAZ...');
      const resultado = await this.enviarParaSefaz(xmlAssinado);
      console.log('📥 Resposta SEFAZ:', resultado);
      
      // Move para pasta apropriada baseado no resultado
      if (resultado.sucesso) {
        const caminhoFinal = path.join(this.ENVIADAS_DIR, nomeArquivo);
        fs.renameSync(caminhoXml, caminhoFinal);
        
        console.log('✅ NFe emitida com sucesso!');
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
        
        console.log('❌ Falha na emissão da NFe');
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
      <CNPJ>${(this.CNPJ_EMITENTE || dados.emitente.cnpj || '').replace(/\D/g, '')}</CNPJ>
      <xNome>${dados.emitente.razaoSocial}</xNome>
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

  async consultarNFe(chave) {
    try {
      console.log(`🔍 Consultando NFe: ${chave}`);
      
      // Se estiver em modo simulação, usar dados simulados
      if (process.env.SIMULATION_MODE === 'true') {
        const situacoes = ['Autorizada', 'Cancelada', 'Denegada'];
        const situacao = situacoes[Math.floor(Math.random() * situacoes.length)];
        
        const resultado = {
          chave,
          situacao,
          protocolo: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
          dataHora: new Date().toISOString(),
          motivo: situacao === 'Autorizada' ? 'Autorizado o uso da NF-e' : 
                 situacao === 'Cancelada' ? 'Cancelamento de NF-e homologado' :
                 'Uso Denegado'
        };
        
        console.log('✅ Consulta simulada realizada:', resultado);
        return resultado;
      }
      
      // Integração real com SEFAZ
      if (!this.emissor) {
        this.emissor = new EmissorNFeAxios();
      }
      
      const resultado = await this.emissor.consultarNFe(chave);
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
      console.log(`🚫 Cancelando NFe: ${chave}`);
      console.log(`📝 Justificativa: ${justificativa}`);
      console.log(`🔧 SIMULATION_MODE: ${process.env.SIMULATION_MODE}`);
      console.log(`🔧 AMBIENTE: ${process.env.AMBIENTE}`);
      
      // Validações
      if (!chave || chave.length !== 44) {
        console.error('❌ Chave de acesso inválida:', chave);
        throw new Error('Chave de acesso inválida');
      }
      
      if (!justificativa || justificativa.length < 15) {
        console.error('❌ Justificativa inválida:', justificativa);
        throw new Error('Justificativa deve ter pelo menos 15 caracteres');
      }
      
      console.log('✅ Validações passaram');
      
      // Se estiver em modo simulação
      if (process.env.SIMULATION_MODE === 'true') {
        console.log('🎭 Processando cancelamento em modo simulação');
        const resultado = {
          chave,
          situacao: 'Cancelada',
          protocolo: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
          dataHora: new Date().toISOString(),
          motivo: 'Cancelamento de NF-e homologado',
          justificativa
        };
        
        console.log('✅ Cancelamento simulado processado:', resultado);
        return resultado;
      }
      
      // Integração real com SEFAZ
      console.log('🌐 Processando cancelamento real com SEFAZ');
      if (!this.emissor) {
        console.log('🔧 Criando nova instância do EmissorNFeAxios');
        this.emissor = new EmissorNFeAxios();
        await this.emissor.inicializar();
      }
      
      console.log('📤 Enviando cancelamento para SEFAZ...');
      const resultado = await this.emissor.cancelarNFe(chave, justificativa);
      console.log('✅ Cancelamento SEFAZ processado:', resultado);
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro no cancelamento:', error.message);
      console.error('❌ Stack trace:', error.stack);
      throw error;
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
      const simulacao = process.env.SIMULATION_MODE === 'true';
      return {
        certificado: {
          carregado: !!this.chavePrivada,
          caminho: this.CERT_PATH,
          valido: true // Implementar validação real
        },
        sefaz: {
          disponivel: await this.verificarStatusSefaz(),
          ambiente: this.AMBIENTE === "1" ? "Produção" : "Homologação",
          uf: this.UF,
          simulacao
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
      'MS': '28',
      'SP': '35',
      'RJ': '33',
      'MG': '31'
      // Adicionar outros estados conforme necessário
    };
    return codigos[uf] || '28';
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
      // Tentativa simples de inicializar cliente e checar WSDL
      const client = new SefazClient({
        certPath: this.CERT_PATH,
        certPass: this.CERT_PASS,
        uf: this.UF,
        ambiente: this.AMBIENTE,
        timeout: 8000
      });
      await client.init();
      return true;
    } catch (error) {
      console.warn('⚠️ SEFAZ indisponível:', error.message);
      return false;
    }
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

  validarXmlSeguranca(xml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");
      
      // Checa se tem <infNFe> tag obrigatória
      const infNFe = doc.getElementsByTagName('infNFe')[0];
      if (!infNFe) {
        throw new Error('XML inválido: Tag <infNFe> obrigatória ausente - possível injection');
      }
      
      // Checa CNPJ emitente matches env
      const cnpj = doc.getElementsByTagName('CNPJ')[0];
      if (cnpj && cnpj.textContent !== this.CNPJ_EMITENTE) {
        throw new Error('XML inválido: CNPJ emitente não autorizado');
      }
      
      console.log('✅ XML validado com sucesso');
    } catch (error) {
      console.error('❌ Erro validação XML:', error.message);
      throw new Error(`Validação XML falhou: ${error.message}`);
    }
  }
}

module.exports = new NFeService();
