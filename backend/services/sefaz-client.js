const fs = require('fs');
const path = require('path');
const soap = require('soap');
const WS_URLS = require('../ws_urls_uf');

class SefazClient {
  constructor({ certPath, certPass, uf, ambiente, timeout = 30000 }) {
    this.certPath = certPath;
    this.certPass = certPass;
    this.uf = uf || 'MS';
    this.ambiente = ambiente || '2'; // 1=Produção, 2=Homologação
    this.timeout = timeout;
    this.pfxData = null;
    this.client = null;
    this.caCerts = this.loadBrazilianCACerts();
  }

  // Carregar certificados da cadeia brasileira
  loadBrazilianCACerts() {
    const certs = [];
    const certPaths = [
      path.join(__dirname, '..', 'certs', 'Autoridade Certificadora Raiz Brasileira v10.cer'),
      path.join(__dirname, '..', 'certs', 'cadeias_certificados_2024', 'AC SOLUTI SSL EV.cer'),
      path.join(__dirname, '..', 'certs', 'cadeias_certificados_2024', 'AC_VALID_SSL_EV.cer'),
      path.join(__dirname, '..', 'certs', 'cadeias_certificados_2024', 'Autoridade Certificadora Raiz Brasileira v10.cer')
    ];

    for (const certPath of certPaths) {
      if (fs.existsSync(certPath)) {
        try {
          const cert = fs.readFileSync(certPath);
          certs.push(cert);
          console.log(`✓ Certificado CA brasileiro carregado: ${path.basename(certPath)}`);
        } catch (error) {
          console.log(`✗ Erro ao carregar certificado ${path.basename(certPath)}: ${error.message}`);
        }
      }
    }

    return certs;
  }

  getWsdlUrl() {
    const url = WS_URLS[this.uf]?.[this.ambiente];
    if (!url) {
      throw new Error(`URL WSDL não encontrada para UF=${this.uf}, Ambiente=${this.ambiente}`);
    }
    return url;
  }

  async init() {
    if (!this.certPath) throw new Error('CERT_PATH não definido');
    if (!this.certPass || this.certPass.trim() === '' || this.certPass === 'ALTERE_AQUI_SUA_SENHA') {
      throw new Error('CERT_PASS inválido ou não definido');
    }

    const fullCertPath = path.isAbsolute(this.certPath)
      ? this.certPath
      : path.resolve(path.join(__dirname, '..'), this.certPath);
    if (!fs.existsSync(fullCertPath)) {
      throw new Error(`Certificado não encontrado em: ${fullCertPath}`);
    }

    this.pfxData = fs.readFileSync(fullCertPath);

    const wsdlUrl = this.getWsdlUrl();

    // Tentar primeiro com SSL adequado usando certificados brasileiros
    let wsdlOptions = {
      timeout: this.timeout,
      strictSSL: true,
      rejectUnauthorized: true,
      ca: this.caCerts.length > 0 ? this.caCerts : undefined,
      secureProtocol: 'TLSv1_2_method',
      pfx: this.pfxData,
      passphrase: this.certPass,
      agent: false,
      headers: {
        Connection: 'close',
        'User-Agent': 'NFe-Node-Client/1.0'
      }
    };

    try {
      console.log(`🔐 Tentando conexão SSL segura com certificados brasileiros...`);
      this.client = await soap.createClientAsync(wsdlUrl, wsdlOptions);
      console.log(`✅ Conexão SSL segura estabelecida!`);
    } catch (sslError) {
      console.log(`⚠️ Falha SSL segura: ${sslError.message}`);
      console.log(`🔄 Tentando fallback com SSL relaxado...`);
      
      // Fallback para SSL relaxado
      wsdlOptions = {
        timeout: this.timeout,
        strictSSL: false,
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method',
        pfx: this.pfxData,
        passphrase: this.certPass,
        agent: false,
        headers: {
          Connection: 'close',
          'User-Agent': 'NFe-Node-Client/1.0'
        }
      };

      this.client = await soap.createClientAsync(wsdlUrl, wsdlOptions);
      console.log(`⚠️ Conexão estabelecida com SSL relaxado (não recomendado para produção)`);
    }

    // SSL Security - usar configuração adequada se certificados brasileiros estão disponíveis
    const securityOptions = this.caCerts.length > 0 ? {
      strictSSL: true,
      rejectUnauthorized: true,
      ca: this.caCerts,
      secureProtocol: 'TLSv1_2_method'
    } : {
      strictSSL: false,
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method'
    };

    const security = new soap.ClientSSLSecurity(this.pfxData, this.certPass, securityOptions);
    this.client.setSecurity(security);

    // Endpoint explícito
    const endpoint = wsdlUrl.replace('?wsdl', '');
    this.client.setEndpoint(endpoint);
  }

  // Envio do lote NFeAutorizacao4
  async enviarLote(xmlAssinado) {
    if (!this.client) {
      await this.init();
    }

    // Muitos UFs usam operação `NFeAutorizacaoLote` e payload `{ nfeDadosMsg: xml }`
    // Alguns exigem `cteDadosMsg` ou nomes diferentes; vamos usar o comum e permitir override.
    try {
      const args = { nfeDadosMsg: xmlAssinado };
      const [result] = await this.client.NFeAutorizacaoLoteAsync(args);
      return result;
    } catch (err) {
      // Alguns servidores usam operação `nfeAutorizacaoLote`
      if (this.client.nfeAutorizacaoLoteAsync) {
        const args = { nfeDadosMsg: xmlAssinado };
        const [result] = await this.client.nfeAutorizacaoLoteAsync(args);
        return result;
      }
      throw err;
    }
  }

  async consultar(chave) {
    if (!this.client) {
      await this.init();
    }
    // Dependendo do serviço, a consulta pode ser em outro endpoint. Placeholder.
    if (!this.client.NFeConsultaProtocolo4Async) {
      throw new Error('Operação de consulta não disponível no WSDL carregado');
    }
    const args = { nfeDadosMsg: `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${this.ambiente}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>` };
    const [result] = await this.client.NFeConsultaProtocolo4Async(args);
    return result;
  }

  async cancelar(xmlCancelamentoAssinado) {
    if (!this.client) {
      await this.init();
    }
    if (!this.client.RecepcaoEvento4Async && !this.client.recepcaoEventoAsync) {
      throw new Error('Operação de cancelamento não disponível no WSDL carregado');
    }
    const args = { nfeDadosMsg: xmlCancelamentoAssinado };
    const op = this.client.RecepcaoEvento4Async || this.client.recepcaoEventoAsync;
    const [result] = await op.call(this.client, args);
    return result;
  }

  async inutilizar(xmlInutilizacaoAssinado) {
    if (!this.client) {
      await this.init();
    }
    // Alguns UFs: NFeInutilizacao4; outros: nfeInutilizacaoNF ou nfeInutilizacao
    const op = this.client.NFeInutilizacao4Async 
      || this.client.nfeInutilizacaoNFAsync 
      || this.client.nfeInutilizacaoAsync;
    if (!op) {
      throw new Error('Operação de inutilização não disponível no WSDL carregado');
    }
    const args = { nfeDadosMsg: xmlInutilizacaoAssinado };
    const [result] = await op.call(this.client, args);
    return result;
  }
}

module.exports = SefazClient;