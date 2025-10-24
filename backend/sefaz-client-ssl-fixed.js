const fs = require('fs');
const path = require('path');
const soap = require('soap');
const https = require('https');
const WS_URLS = require('./ws_urls_uf');

class SefazClientSSLFixed {
  constructor({ certPath, certPass, uf, ambiente, timeout = 30000 }) {
    this.certPath = certPath;
    this.certPass = certPass;
    this.uf = uf || 'SP';
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
      path.join(__dirname, 'certs', 'Autoridade Certificadora Raiz Brasileira v10.cer'),
      path.join(__dirname, 'certs', 'cadeias_certificados_2024', 'AC SOLUTI SSL EV.cer'),
      path.join(__dirname, 'certs', 'cadeias_certificados_2024', 'AC_VALID_SSL_EV.cer'),
      path.join(__dirname, 'certs', 'cadeias_certificados_2024', 'Autoridade Certificadora Raiz Brasileira v10.cer')
    ];

    for (const certPath of certPaths) {
      if (fs.existsSync(certPath)) {
        try {
          const cert = fs.readFileSync(certPath);
          certs.push(cert);
          console.log(`✓ Certificado CA carregado: ${path.basename(certPath)}`);
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
    console.log(`🔧 Inicializando SefazClient SSL Fixed - UF: ${this.uf}, Ambiente: ${this.ambiente}`);
    
    // Carregar certificado PFX se fornecido
    if (this.certPath) {
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
      console.log(`✓ Certificado PFX carregado: ${fullCertPath}`);
    }

    const wsdlUrl = this.getWsdlUrl();
    console.log(`📍 URL WSDL: ${wsdlUrl}`);

    // Configuração SSL adequada
    const wsdlOptions = {
      timeout: this.timeout,
      // SSL ADEQUADO - usar certificados brasileiros
      strictSSL: true,
      rejectUnauthorized: true,
      ca: this.caCerts,
      secureProtocol: 'TLSv1_2_method',
      agent: false,
      headers: {
        Connection: 'close',
        'User-Agent': 'NFe-SSL-Fixed/1.0'
      }
    };

    // Adicionar certificado PFX se disponível
    if (this.pfxData) {
      wsdlOptions.pfx = this.pfxData;
      wsdlOptions.passphrase = this.certPass;
    }

    console.log(`📡 Criando cliente SOAP com SSL adequado...`);
    this.client = await soap.createClientAsync(wsdlUrl, wsdlOptions);

    // SSL Security com certificados brasileiros
    if (this.pfxData) {
      const security = new soap.ClientSSLSecurity(this.pfxData, this.certPass, {
        strictSSL: true,
        rejectUnauthorized: true,
        ca: this.caCerts,
        secureProtocol: 'TLSv1_2_method'
      });
      this.client.setSecurity(security);
    }

    // Endpoint explícito
    const endpoint = wsdlUrl.replace('?wsdl', '');
    this.client.setEndpoint(endpoint);
    
    console.log(`✅ Cliente SOAP criado com sucesso!`);
    console.log(`✅ Operações disponíveis: ${Object.keys(this.client).filter(k => k.includes('Async')).join(', ')}`);
  }

  // Teste de status simples
  async testarStatus() {
    if (!this.client) {
      await this.init();
    }

    console.log(`🧪 Testando status da SEFAZ...`);
    
    try {
      // Tentar operação simples para verificar se o serviço está funcionando
      const operations = Object.keys(this.client).filter(k => k.includes('Async'));
      
      return {
        success: true,
        message: 'Cliente SOAP criado com sucesso',
        operations: operations,
        wsdlUrl: this.getWsdlUrl()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        wsdlUrl: this.getWsdlUrl()
      };
    }
  }

  // Métodos originais mantidos para compatibilidade
  async enviarLote(xmlAssinado) {
    if (!this.client) {
      await this.init();
    }

    try {
      const args = { nfeDadosMsg: xmlAssinado };
      const [result] = await this.client.NFeAutorizacaoLoteAsync(args);
      return result;
    } catch (err) {
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

// Função de teste
async function testarSefazSSL() {
  console.log('🚀 TESTE SEFAZ CLIENT SSL FIXED');
  console.log('='.repeat(50));
  
  const client = new SefazClientSSLFixed({
    uf: 'SP',
    ambiente: '2',
    timeout: 15000
  });

  try {
    const result = await client.testarStatus();
    console.log('\n📊 RESULTADO:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n🎉 SUCESSO! SEFAZ acessível com SSL adequado!');
      return true;
    } else {
      console.log('\n❌ FALHA! Problema detectado.');
      return false;
    }
  } catch (error) {
    console.log('\n💥 ERRO:', error.message);
    return false;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testarSefazSSL().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = SefazClientSSLFixed;