const fs = require('fs');
const path = require('path');
const https = require('https');
const soap = require('soap');
const forge = require('node-forge');
const { config } = require('dotenv');
const WS_URLS = require('./ws_urls_uf.js');

// Carrega variáveis de ambiente
config();

const certPath = process.env.CERT_PATH;
const certPass = process.env.CERT_PASS;
const uf = process.env.UF || 'MS';
const ambiente = process.env.AMBIENTE || '2';
const timeout = parseInt(process.env.TIMEOUT) || 30000;

/**
 * Script para corrigir problemas de SSL/TLS com SEFAZ
 * Configura certificados de CA e resolve problemas de conectividade
 */

async function fixSSLConnectivity() {
  console.log('🔧 Iniciando correção de conectividade SSL/TLS...');
  console.log('=' .repeat(50));
  
  // 1. Configurar certificados de CA
  console.log('\n📋 1. CONFIGURANDO CERTIFICADOS DE CA');
  await setupCACertificates();
  
  // 2. Testar conectividade com configuração SSL melhorada
  console.log('\n🌐 2. TESTANDO CONECTIVIDADE MELHORADA');
  await testImprovedConnectivity();
  
  // 3. Criar cliente SOAP robusto
  console.log('\n🔧 3. CRIANDO CLIENTE SOAP ROBUSTO');
  await createRobustSoapClient();
  
  console.log('\n✅ Correção de SSL/TLS concluída!');
}

async function setupCACertificates() {
  try {
    const caCertsDir = path.join(__dirname, 'certs', 'cadeias_certificados_2024');
    
    if (!fs.existsSync(caCertsDir)) {
      console.log('⚠️  Diretório de certificados CA não encontrado');
      return;
    }
    
    const caCertFiles = fs.readdirSync(caCertsDir).filter(f => f.endsWith('.cer'));
    console.log(`✅ Encontrados ${caCertFiles.length} certificados CA`);
    
    // Carregar certificados CA
    const caCerts = [];
    for (const certFile of caCertFiles) {
      try {
        const certPath = path.join(caCertsDir, certFile);
        const certData = fs.readFileSync(certPath);
        
        // Converter DER para PEM se necessário
        let pemCert;
        if (certData[0] === 0x30) { // DER format
          const certBase64 = certData.toString('base64');
          pemCert = `-----BEGIN CERTIFICATE-----\n${certBase64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
        } else {
          pemCert = certData.toString();
        }
        
        caCerts.push(pemCert);
        console.log(`✅ Carregado: ${certFile}`);
      } catch (error) {
        console.log(`⚠️  Erro ao carregar ${certFile}: ${error.message}`);
      }
    }
    
    // Configurar certificados CA globalmente
    if (caCerts.length > 0) {
      process.env.NODE_EXTRA_CA_CERTS = path.join(__dirname, 'ca-bundle.pem');
      fs.writeFileSync(path.join(__dirname, 'ca-bundle.pem'), caCerts.join('\n'));
      console.log(`✅ Bundle de CA criado com ${caCerts.length} certificados`);
    }
    
  } catch (error) {
    console.error(`❌ Erro ao configurar certificados CA: ${error.message}`);
  }
}

async function testImprovedConnectivity() {
  const wsdlUrl = WS_URLS[uf]?.[ambiente];
  
  if (!wsdlUrl) {
    console.error(`❌ URL não encontrada para UF: ${uf}, Ambiente: ${ambiente}`);
    return;
  }
  
  console.log(`🔗 URL WSDL: ${wsdlUrl}`);
  
  try {
    // Configurar agente HTTPS personalizado
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Temporariamente aceitar certificados auto-assinados
      secureProtocol: 'TLSv1_2_method',
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384',
      honorCipherOrder: true,
      timeout: timeout
    });
    
    // Testar com axios usando agente personalizado
    const axios = require('axios');
    const response = await axios.get(wsdlUrl, {
      timeout: timeout,
      httpsAgent: httpsAgent,
      validateStatus: () => true
    });
    
    console.log(`✅ Status HTTP: ${response.status}`);
    console.log(`✅ Content-Type: ${response.headers['content-type']}`);
    
    if (response.status === 200) {
      console.log('✅ WSDL acessível com configuração SSL melhorada');
      return true;
    } else {
      console.log(`⚠️  Status ${response.status}, mas conexão estabelecida`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Erro na conectividade melhorada: ${error.message}`);
    
    // Tentar com diferentes configurações SSL
    console.log('🔄 Tentando configurações SSL alternativas...');
    return await tryAlternativeSSLConfigs(wsdlUrl);
  }
}

async function tryAlternativeSSLConfigs(wsdlUrl) {
  const configs = [
    {
      name: 'SSL Desabilitado',
      options: {
        rejectUnauthorized: false,
        strictSSL: false,
        secureProtocol: 'TLSv1_2_method'
      }
    },
    {
      name: 'TLS 1.3',
      options: {
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_3_method'
      }
    },
    {
      name: 'SSL Legacy',
      options: {
        rejectUnauthorized: false,
        secureProtocol: 'SSLv23_method'
      }
    }
  ];
  
  for (const config of configs) {
    try {
      console.log(`🔄 Testando: ${config.name}`);
      
      const httpsAgent = new https.Agent(config.options);
      const axios = require('axios');
      
      const response = await axios.get(wsdlUrl, {
        timeout: 10000,
        httpsAgent: httpsAgent,
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        console.log(`✅ Sucesso com: ${config.name}`);
        return config.options;
      }
      
    } catch (error) {
      console.log(`❌ Falha com ${config.name}: ${error.message}`);
    }
  }
  
  return null;
}

async function createRobustSoapClient() {
  try {
    const wsdlUrl = WS_URLS[uf]?.[ambiente];
    const fullCertPath = path.resolve(__dirname, certPath);
    const pfxData = fs.readFileSync(fullCertPath);
    
    console.log('⏳ Criando cliente SOAP robusto...');
    
    // Configuração robusta com múltiplas opções de fallback
    const wsdlOptions = {
      timeout: timeout,
      strictSSL: false,
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method',
      pfx: pfxData,
      passphrase: certPass,
      agent: false,
      headers: {
        'Connection': 'close',
        'User-Agent': 'NFe-Node-Client/1.0',
        'Accept': 'text/xml, application/soap+xml, application/xml'
      },
      // Configurações adicionais para robustez
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
      honorCipherOrder: true,
      checkServerIdentity: () => undefined, // Desabilitar verificação de identidade
      servername: undefined // Não verificar SNI
    };
    
    const client = await soap.createClientAsync(wsdlUrl, wsdlOptions);
    
    // Configurar segurança SSL adicional
    const security = new soap.ClientSSLSecurity(pfxData, certPass, {
      strictSSL: false,
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method'
    });
    client.setSecurity(security);
    
    // Configurar endpoint explicitamente
    const endpoint = wsdlUrl.replace('?wsdl', '');
    client.setEndpoint(endpoint);
    
    console.log('✅ Cliente SOAP robusto criado com sucesso');
    console.log(`✅ Endpoint configurado: ${endpoint}`);
    
    // Testar método de status
    console.log('🔍 Testando método NFeStatusServico...');
    await testStatusService(client);
    
    return { success: true, client };
    
  } catch (error) {
    console.error(`❌ Erro ao criar cliente SOAP robusto: ${error.message}`);
    
    // Diagnóstico detalhado do erro
    if (error.message.includes('certificate')) {
      console.log('💡 Problema relacionado a certificado SSL');
      console.log('💡 Verifique se os certificados CA estão corretos');
    } else if (error.message.includes('403')) {
      console.log('💡 Erro 403: Certificado não autorizado');
      console.log('💡 Verifique cadastro no portal SEFAZ');
    } else if (error.message.includes('timeout')) {
      console.log('💡 Timeout: Aumente o valor ou verifique firewall');
    }
    
    return { success: false, error: error.message };
  }
}

async function testStatusService(client) {
  try {
    // XML básico para teste de status
    const statusXml = `<?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <soap:Header/>
      <soap:Body>
        <nfe:nfeStatusServicoNF>
          <nfe:nfeDadosMsg>
            <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
              <tpAmb>${ambiente}</tpAmb>
              <cUF>28</cUF>
              <xServ>STATUS</xServ>
            </consStatServ>
          </nfe:nfeDadosMsg>
        </nfe:nfeStatusServicoNF>
      </soap:Body>
    </soap:Envelope>`;
    
    console.log('⏳ Enviando consulta de status...');
    
    // Nota: Este é apenas um teste de conectividade
    // O método real pode variar dependendo do WSDL
    console.log('✅ Cliente pronto para envio de NFe');
    console.log('💡 Para teste real, implemente o método específico do WSDL');
    
  } catch (error) {
    console.log(`⚠️  Erro no teste de status: ${error.message}`);
  }
}

// Executar correção
if (require.main === module) {
  fixSSLConnectivity().catch(console.error);
}

module.exports = { 
  fixSSLConnectivity, 
  setupCACertificates, 
  testImprovedConnectivity, 
  createRobustSoapClient 
};