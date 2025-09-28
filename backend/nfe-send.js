const fs = require('fs');
const path = require('path');
const soap = require('soap');
const { config } = require('dotenv');
const WS_URLS = require('./ws_urls_uf.js');

// Carrega variáveis de ambiente
config();

const xmlDir = path.join(__dirname, 'xmls', 'falhas');
const enviadasDir = path.join(__dirname, 'xmls', 'enviadas');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(enviadasDir)) fs.mkdirSync(enviadasDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logFile = path.join(logsDir, 'envio.csv');
if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, 'arquivo;status;motivo;data\n', 'utf8');

// Validação de variáveis de ambiente
const certPath = process.env.CERT_PATH;
const certPass = process.env.CERT_PASS;
const uf = process.env.UF || 'MS';
const ambiente = process.env.AMBIENTE || '2'; // 1=Prod, 2=Homologação
const timeout = parseInt(process.env.TIMEOUT) || 30000;
const retryAttempts = parseInt(process.env.RETRY_ATTEMPTS) || 3;

// Validações críticas
if (!certPath) {
  console.error('❌ ERRO: CERT_PATH não definido no arquivo .env');
  process.exit(1);
}

if (!certPass || certPass.trim() === '' || certPass === 'ALTERE_AQUI_SUA_SENHA') {
  console.error('❌ ERRO: CERT_PASS não definido ou não alterado no arquivo .env');
  console.error(`🔍 Valor atual: "${certPass}"`);
  console.error('💡 Edite o arquivo .env e defina uma senha válida para o certificado');
  process.exit(1);
}

const fullCertPath = path.resolve(__dirname, certPath);
if (!fs.existsSync(fullCertPath)) {
  console.error(`❌ ERRO: Certificado não encontrado em: ${fullCertPath}`);
  process.exit(1);
}

async function enviarNFes() {
  const xmlFiles = fs.readdirSync(xmlDir).filter(f => f.endsWith('.xml'));

  console.log('🚀 Iniciando envio de NFe...');
  console.log(`Certificado: ${certPath}`);
  console.log(`UF: ${uf}, Ambiente: ${ambiente}`);
  console.log(`XMLs encontrados: ${xmlFiles.length}\n`);

  for (const xmlFile of xmlFiles) {
  const xmlPath = path.join(xmlDir, xmlFile);
  let attempts = 0;
  let sent = false;

  while (attempts < retryAttempts && !sent) {
    attempts++;
    try {
      console.log(`⏳ Lendo XML: ${xmlPath}`);
      const xmlContent = fs.readFileSync(xmlPath, 'utf8');

      console.log(`⏳ Criando client SOAP para SEFAZ ${uf}... (Tentativa ${attempts}/${retryAttempts})`);
      
      // Obtém URL correta do arquivo ws_urls_uf.js
      const wsdlUrl = WS_URLS[uf]?.[ambiente];
      if (!wsdlUrl) {
        throw new Error(`URL não encontrada para UF: ${uf}, Ambiente: ${ambiente}`);
      }

      console.log(`🔗 URL WSDL: ${wsdlUrl}`);

      // Carregar certificado antes de criar o cliente
      const pfxData = fs.readFileSync(fullCertPath);
      
      // Configuração robusta com certificado integrado
      const wsdlOptions = {
        timeout: timeout,
        strictSSL: false,
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method',
        pfx: pfxData,
        passphrase: certPass,
        agent: false, // Força nova conexão
        headers: {
          'Connection': 'close', // Evita keep-alive
          'User-Agent': 'NFe-Node-Client/1.0'
        }
      };

      const client = await soap.createClientAsync(wsdlUrl, wsdlOptions);
      
      // Configuração adicional de segurança SSL
      const security = new soap.ClientSSLSecurity(pfxData, certPass, {
        strictSSL: false,
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method'
      });
      client.setSecurity(security);

      // Configurar endpoint explicitamente
      const endpoint = wsdlUrl.replace('?wsdl', '');
      client.setEndpoint(endpoint);

      // Aqui você envia o XML; exemplo genérico:
      // const [result] = await client.NFeAutorizacaoLoteAsync({ nfeDadosMsg: xmlContent });
      
      console.log(`✅ ${xmlFile} processado com sucesso! (Cliente SOAP criado)`);
      console.log(`ℹ️  Para envio real, descomente a linha de envio no código`);
      
      fs.renameSync(xmlPath, path.join(enviadasDir, xmlFile));
      fs.appendFileSync(logFile, `${xmlFile};SUCESSO;;${new Date().toISOString()}\n`, 'utf8');
      sent = true;
    } catch (err) {
      console.log(`❌ Erro no envio de ${xmlFile}: ${err.message}`);
      console.log(`🔍 Detalhes: ${err.code || 'N/A'} - ${err.errno || 'N/A'}`);
      
      if (attempts >= retryAttempts) {
        fs.appendFileSync(logFile, `${xmlFile};FALHA;${err.message};${new Date().toISOString()}\n`, 'utf8');
        console.log(`💀 Falha definitiva após ${retryAttempts} tentativas`);
      } else {
        console.log(`🔁 Tentando novamente em 2 segundos... (${attempts}/${retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  }

  console.log('\n🎯 Processo concluído.');
}

// Executar a função principal
enviarNFes().catch(console.error);
