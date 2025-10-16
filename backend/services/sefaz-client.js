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

    const wsdlOptions = {
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

    // SSL Security
    const security = new soap.ClientSSLSecurity(this.pfxData, this.certPass, {
      strictSSL: false,
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method'
    });
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
}

module.exports = SefazClient;