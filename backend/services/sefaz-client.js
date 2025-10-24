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

    // Adicionar certificados do sistema se disponíveis
    try {
      const systemCerts = require('tls').rootCertificates;
      if (systemCerts && systemCerts.length > 0) {
        systemCerts.forEach(cert => certs.push(Buffer.from(cert)));
        console.log(`✓ ${systemCerts.length} certificados do sistema adicionados`);
      }
    } catch (error) {
      console.log('⚠️ Não foi possível carregar certificados do sistema');
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

    // Configuração SSL robusta para produção
    const wsdlOptions = {
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
      },
      // Configurações adicionais para resolver problemas SSL
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384',
      honorCipherOrder: true,
      secureOptions: require('constants').SSL_OP_NO_SSLv2 | require('constants').SSL_OP_NO_SSLv3
    };

    let sslSuccess = false;
    let lastError = null;

    // Estratégia 1: SSL seguro com certificados brasileiros
    try {
      console.log(`🔐 Tentando conexão SSL segura com certificados brasileiros...`);
      this.client = await soap.createClientAsync(wsdlUrl, wsdlOptions);
      console.log(`✅ Conexão SSL segura estabelecida!`);
      sslSuccess = true;
    } catch (sslError) {
      console.log(`⚠️ Falha SSL segura: ${sslError.message}`);
      lastError = sslError;
      
      // Estratégia 2: SSL com certificados do sistema apenas
      try {
        console.log(`🔄 Tentando com certificados do sistema...`);
        wsdlOptions.ca = undefined; // Usar certificados padrão do sistema
        this.client = await soap.createClientAsync(wsdlUrl, wsdlOptions);
        console.log(`✅ Conexão estabelecida com certificados do sistema!`);
        sslSuccess = true;
      } catch (systemError) {
        console.log(`⚠️ Falha com certificados do sistema: ${systemError.message}`);
        lastError = systemError;
        
        // Estratégia 3: SSL relaxado para produção (último recurso)
        try {
          console.log(`🔄 Tentando configuração SSL relaxada para produção...`);
          wsdlOptions.strictSSL = false;
          wsdlOptions.rejectUnauthorized = false;
          delete wsdlOptions.ca; // Remover CA personalizado
          
          this.client = await soap.createClientAsync(wsdlUrl, wsdlOptions);
          console.log(`⚠️ Conexão estabelecida com SSL relaxado (modo produção)`);
          sslSuccess = true;
        } catch (fallbackError) {
          console.error(`❌ Falha total na conexão SSL: ${fallbackError.message}`);
          lastError = fallbackError;
        }
      }
    }

    if (!sslSuccess) {
      throw new Error(`Não foi possível estabelecer conexão SSL com SEFAZ: ${lastError.message}`);
    }

    // SSL Security - configurar baseado no sucesso da conexão
    let securityOptions;
    if (sslSuccess && wsdlOptions.strictSSL !== false) {
      // Usar configuração segura se SSL funcionou
      securityOptions = {
        strictSSL: true,
        rejectUnauthorized: true,
        ca: this.caCerts.length > 0 ? this.caCerts : undefined,
        secureProtocol: 'TLSv1_2_method',
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384'
      };
    } else {
      // Usar configuração relaxada se necessário
      securityOptions = {
        strictSSL: false,
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method'
      };
    }

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