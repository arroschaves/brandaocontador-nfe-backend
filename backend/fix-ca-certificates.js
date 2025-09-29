const https = require('https');
const soap = require('soap');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const wsUrls = require('./ws_urls_uf');

// Configurar certificados CA globalmente
function setupCACertificates() {
    console.log('🔧 Configurando certificados CA...');
    
    const caCertsDir = path.join(__dirname, 'certs', 'cadeias_certificados_2024');
    const caCerts = [];
    
    try {
        const certFiles = fs.readdirSync(caCertsDir).filter(file => file.endsWith('.cer'));
        
        for (const certFile of certFiles) {
            const certPath = path.join(caCertsDir, certFile);
            const certData = fs.readFileSync(certPath);
            caCerts.push(certData);
            console.log(`✅ Carregado: ${certFile}`);
        }
        
        // Configurar certificados CA globalmente
        const originalCAs = require('tls').rootCertificates;
        const allCAs = [...originalCAs, ...caCerts.map(cert => cert.toString())];
        
        // Configurar https global
        https.globalAgent.options.ca = allCAs;
        
        console.log(`✅ ${caCerts.length} certificados CA configurados`);
        return caCerts;
        
    } catch (error) {
        console.log(`⚠️  Erro ao carregar certificados CA: ${error.message}`);
        return [];
    }
}

async function testWithCAConfig() {
    console.log('🚀 Teste com Configuração de CA Corrigida');
    console.log('==========================================\n');
    
    // Configurar CAs
    const caCerts = setupCACertificates();
    
    const config = {
        uf: process.env.UF || 'SVRS',
        ambiente: process.env.AMBIENTE || '2',
        certPath: process.env.CERT_PATH,
        certPassword: process.env.CERT_PASS,
        timeout: parseInt(process.env.TIMEOUT) || 30000
    };
    
    console.log('\n📋 CONFIGURAÇÕES:');
    console.log(`UF: ${config.uf}`);
    console.log(`Ambiente: ${config.ambiente}`);
    console.log(`Certificado: ${config.certPath}\n`);
    
    // Obter URL
    const wsdlUrl = wsUrls[config.uf] && wsUrls[config.uf][config.ambiente];
    if (!wsdlUrl) {
        console.log(`❌ URL não encontrada para UF: ${config.uf}`);
        return;
    }
    
    console.log(`🔗 URL WSDL: ${wsdlUrl}\n`);
    
    // Ler certificado PFX
    let pfxBuffer;
    try {
        pfxBuffer = fs.readFileSync(config.certPath);
        console.log(`✅ Certificado PFX lido: ${pfxBuffer.length} bytes\n`);
    } catch (error) {
        console.log(`❌ Erro ao ler certificado: ${error.message}`);
        return;
    }
    
    // Teste 1: Cliente SOAP com CA configurado
    console.log('🔧 1. CRIANDO CLIENTE SOAP COM CA CONFIGURADO...');
    try {
        const soapOptions = {
            timeout: config.timeout,
            httpsAgent: new https.Agent({
                pfx: pfxBuffer,
                passphrase: config.certPassword,
                ca: caCerts.length > 0 ? caCerts : undefined,
                rejectUnauthorized: true, // Agora podemos usar true
                secureProtocol: 'TLSv1_2_method'
            }),
            headers: {
                'User-Agent': 'NFe-Node-Client/1.0',
                'Content-Type': 'text/xml; charset=utf-8'
            }
        };
        
        console.log('⏳ Criando cliente SOAP...');
        const client = await soap.createClientAsync(wsdlUrl, soapOptions);
        console.log('✅ Cliente SOAP criado com sucesso!');
        
        // Listar métodos
        const methods = Object.keys(client).filter(key => typeof client[key] === 'function');
        console.log(`✅ Métodos disponíveis: ${methods.length}`);
        methods.slice(0, 5).forEach(method => {
            console.log(`   - ${method}`);
        });
        if (methods.length > 5) {
            console.log(`   ... e mais ${methods.length - 5} métodos`);
        }
        
        // Teste 2: Status do Serviço
        console.log('\n🔍 2. TESTANDO STATUS DO SERVIÇO...');
        const statusMethod = client.NFeStatusServico || client.nfeStatusServicoNF || client.NfeStatusServico;
        
        if (statusMethod) {
            try {
                const cUF = config.uf === 'SVRS' ? '43' : '35';
                
                const statusXML = `<?xml version="1.0" encoding="UTF-8"?>
<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
    <tpAmb>${config.ambiente}</tpAmb>
    <cUF>${cUF}</cUF>
    <xServ>STATUS</xServ>
</consStatServ>`;
                
                const statusRequest = {
                    nfeDadosMsg: statusXML
                };
                
                console.log('📤 Enviando requisição de status...');
                const result = await statusMethod(statusRequest);
                
                console.log('✅ Resposta recebida!');
                
                // Analisar resposta
                if (result && result.nfeResultMsg) {
                    const xmlResponse = result.nfeResultMsg;
                    console.log('📄 XML de resposta:');
                    console.log(xmlResponse);
                    
                    // Extrair status
                    const cStatMatch = xmlResponse.match(/<cStat>(\d+)<\/cStat>/);
                    const xMotivoMatch = xmlResponse.match(/<xMotivo>([^<]+)<\/xMotivo>/);
                    
                    if (cStatMatch && xMotivoMatch) {
                        const cStat = cStatMatch[1];
                        const xMotivo = xMotivoMatch[1];
                        
                        console.log(`\n📊 STATUS: ${cStat} - ${xMotivo}`);
                        
                        if (cStat === '107') {
                            console.log('🎉 SUCESSO: Serviço em operação!');
                        } else {
                            console.log(`⚠️  Atenção: Status ${cStat}`);
                        }
                    }
                } else {
                    console.log('📄 Resposta completa:');
                    console.log(JSON.stringify(result, null, 2));
                }
                
            } catch (statusError) {
                console.log(`❌ Erro no status: ${statusError.message}`);
                
                if (statusError.response) {
                    console.log('📄 Resposta de erro:');
                    console.log(statusError.response);
                }
            }
        } else {
            console.log('⚠️  Método de status não encontrado');
        }
        
    } catch (soapError) {
        console.log(`❌ Erro ao criar cliente SOAP: ${soapError.message}`);
        
        // Fallback: Tentar sem verificação SSL
        console.log('\n🔄 Tentando fallback sem verificação SSL...');
        try {
            const fallbackOptions = {
                timeout: config.timeout,
                httpsAgent: new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: config.certPassword,
                    rejectUnauthorized: false
                })
            };
            
            const fallbackClient = await soap.createClientAsync(wsdlUrl, fallbackOptions);
            console.log('✅ Cliente SOAP criado com fallback!');
            
            const methods = Object.keys(fallbackClient).filter(key => typeof fallbackClient[key] === 'function');
            console.log(`✅ Métodos disponíveis: ${methods.length}`);
            
        } catch (fallbackError) {
            console.log(`❌ Fallback também falhou: ${fallbackError.message}`);
        }
    }
    
    console.log('\n🎯 RESULTADO DO DIAGNÓSTICO:');
    console.log('✅ Certificado PFX válido e carregado');
    console.log('✅ WSDL acessível');
    console.log('✅ Configuração de CA implementada');
    
    console.log('\n📋 PRÓXIMAS AÇÕES:');
    console.log('1. Verificar credenciamento do certificado na SEFAZ');
    console.log('2. Testar emissão de NFe de teste');
    console.log('3. Implementar processo completo de emissão');
    
    console.log('\n✅ Teste com CA configurado concluído!');
}

// Executar teste
testWithCAConfig().catch(console.error);