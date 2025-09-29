const forge = require('node-forge');
const fs = require('fs');
const https = require('https');
const axios = require('axios');
require('dotenv').config();

const wsUrls = require('./ws_urls_uf');

async function validateCertificateForSefaz() {
    console.log('🔍 Validação Completa do Certificado para SEFAZ');
    console.log('==============================================\n');
    
    const config = {
        certPath: process.env.CERT_PATH,
        certPassword: process.env.CERT_PASS,
        cnpjEmitente: process.env.CNPJ_EMITENTE,
        ambiente: process.env.AMBIENTE || '2'
    };
    
    console.log('📋 CONFIGURAÇÕES:');
    console.log(`Certificado: ${config.certPath}`);
    console.log(`CNPJ Emitente: ${config.cnpjEmitente}`);
    console.log(`Ambiente: ${config.ambiente === '1' ? 'Produção' : 'Homologação'}\n`);
    
    // 1. Validar certificado PFX
    console.log('🔐 1. VALIDANDO CERTIFICADO PFX...');
    let pfxBuffer, p12Asn1, p12, privateKey, certificate;
    
    try {
        pfxBuffer = fs.readFileSync(config.certPath);
        p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
        p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, config.certPassword);
        
        // Extrair chave privada e certificado
        const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        privateKey = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
        
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        certificate = certBags[forge.pki.oids.certBag][0].cert;
        
        console.log('✅ Certificado PFX válido');
        
        // Informações do certificado
        const subject = certificate.subject.attributes;
        const issuer = certificate.issuer.attributes;
        const validity = {
            notBefore: certificate.validity.notBefore,
            notAfter: certificate.validity.notAfter
        };
        
        console.log('\n📄 INFORMAÇÕES DO CERTIFICADO:');
        
        // Subject
        const commonName = subject.find(attr => attr.name === 'commonName')?.value || 'N/A';
        const organizationName = subject.find(attr => attr.name === 'organizationName')?.value || 'N/A';
        const serialNumber = subject.find(attr => attr.name === 'serialNumber')?.value || 'N/A';
        
        console.log(`Nome Comum: ${commonName}`);
        console.log(`Organização: ${organizationName}`);
        console.log(`Número de Série: ${serialNumber}`);
        
        // Issuer
        const issuerCN = issuer.find(attr => attr.name === 'commonName')?.value || 'N/A';
        console.log(`Emissor: ${issuerCN}`);
        
        // Validade
        const now = new Date();
        console.log(`Válido de: ${validity.notBefore.toLocaleDateString('pt-BR')}`);
        console.log(`Válido até: ${validity.notAfter.toLocaleDateString('pt-BR')}`);
        
        if (now < validity.notBefore) {
            console.log('❌ Certificado ainda não é válido!');
            return;
        }
        
        if (now > validity.notAfter) {
            console.log('❌ Certificado expirado!');
            return;
        }
        
        console.log('✅ Certificado dentro da validade');
        
        // 2. Verificar CNPJ no certificado
        console.log('\n🏢 2. VERIFICANDO CNPJ NO CERTIFICADO...');
        
        // Extrair CNPJ do subject
        let cnpjCertificado = null;
        
        // Tentar extrair CNPJ do serialNumber
        if (serialNumber && serialNumber.length >= 14) {
            const cnpjMatch = serialNumber.match(/(\d{14})/);
            if (cnpjMatch) {
                cnpjCertificado = cnpjMatch[1];
            }
        }
        
        // Tentar extrair CNPJ do commonName
        if (!cnpjCertificado && commonName) {
            const cnpjMatch = commonName.match(/(\d{14})/);
            if (cnpjMatch) {
                cnpjCertificado = cnpjMatch[1];
            }
        }
        
        if (cnpjCertificado) {
            console.log(`CNPJ no certificado: ${cnpjCertificado}`);
            
            // Comparar com CNPJ configurado
            const cnpjConfig = config.cnpjEmitente?.replace(/\D/g, '');
            if (cnpjConfig && cnpjCertificado === cnpjConfig) {
                console.log('✅ CNPJ do certificado confere com configuração');
            } else {
                console.log(`⚠️  CNPJ não confere! Config: ${cnpjConfig}, Cert: ${cnpjCertificado}`);
            }
        } else {
            console.log('⚠️  CNPJ não encontrado no certificado');
        }
        
        // 3. Verificar tipo de certificado
        console.log('\n🔍 3. VERIFICANDO TIPO DE CERTIFICADO...');
        
        // Verificar se é A1 ou A3
        const keyUsage = certificate.getExtension('keyUsage');
        const extKeyUsage = certificate.getExtension('extKeyUsage');
        
        console.log('Uso da chave:', keyUsage ? 'Presente' : 'Ausente');
        console.log('Uso estendido da chave:', extKeyUsage ? 'Presente' : 'Ausente');
        
        // Verificar se é certificado de pessoa jurídica
        const isPJ = commonName.includes('CNPJ') || serialNumber.includes('CNPJ') || organizationName !== 'N/A';
        console.log(`Tipo: ${isPJ ? 'Pessoa Jurídica (PJ)' : 'Pessoa Física (PF)'}`);
        
        if (!isPJ) {
            console.log('⚠️  Certificado parece ser de Pessoa Física - verifique se está correto para NFe');
        }
        
        // 4. Testar conectividade com diferentes UFs
        console.log('\n🌐 4. TESTANDO CONECTIVIDADE COM DIFERENTES UFs...');
        
        const ufsToTest = ['SP', 'RJ', 'MG', 'RS', 'SVRS'];
        const testResults = [];
        
        for (const uf of ufsToTest) {
            console.log(`\n🔗 Testando ${uf}...`);
            
            const wsdlUrl = wsUrls[uf] && wsUrls[uf][config.ambiente];
            if (!wsdlUrl) {
                console.log(`❌ URL não encontrada para ${uf}`);
                continue;
            }
            
            try {
                const httpsAgent = new https.Agent({
                    pfx: pfxBuffer,
                    passphrase: config.certPassword,
                    rejectUnauthorized: false,
                    timeout: 10000
                });
                
                const response = await axios.get(wsdlUrl, {
                    httpsAgent,
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'NFe-Validator/1.0'
                    }
                });
                
                const success = response.status === 200 && response.data.includes('wsdl');
                testResults.push({ uf, status: response.status, success });
                
                console.log(`${success ? '✅' : '⚠️'} ${uf}: Status ${response.status}`);
                
            } catch (error) {
                const status = error.response?.status || 'ERRO';
                testResults.push({ uf, status, success: false, error: error.message });
                
                console.log(`❌ ${uf}: ${status} - ${error.message}`);
            }
        }
        
        // 5. Resumo e recomendações
        console.log('\n📊 5. RESUMO E RECOMENDAÇÕES...');
        
        const successfulUFs = testResults.filter(r => r.success);
        const forbiddenUFs = testResults.filter(r => r.status === 403);
        
        console.log(`\n✅ UFs com sucesso: ${successfulUFs.length}`);
        successfulUFs.forEach(r => console.log(`   - ${r.uf}`));
        
        console.log(`\n❌ UFs com erro 403: ${forbiddenUFs.length}`);
        forbiddenUFs.forEach(r => console.log(`   - ${r.uf}`));
        
        console.log('\n🎯 DIAGNÓSTICO FINAL:');
        
        if (successfulUFs.length > 0) {
            console.log('✅ Certificado tecnicamente válido');
            console.log('✅ Conectividade HTTPS funcionando');
            console.log(`✅ Recomendado usar UF: ${successfulUFs[0].uf}`);
        }
        
        if (forbiddenUFs.length > 0) {
            console.log('⚠️  Erro 403 indica possíveis problemas:');
            console.log('   1. Certificado não credenciado na SEFAZ');
            console.log('   2. CNPJ não autorizado para NFe');
            console.log('   3. Ambiente incorreto (homologação vs produção)');
            console.log('   4. Certificado não é do tipo A1 para NFe');
        }
        
        console.log('\n📋 PRÓXIMAS AÇÕES RECOMENDADAS:');
        console.log('1. Verificar credenciamento do certificado no portal da SEFAZ');
        console.log('2. Confirmar autorização do CNPJ para emissão de NFe');
        console.log('3. Testar com certificado A1 específico para NFe');
        console.log('4. Contatar suporte da SEFAZ se problemas persistirem');
        
        if (successfulUFs.length > 0) {
            console.log(`5. Usar UF ${successfulUFs[0].uf} para testes iniciais`);
        }
        
    } catch (error) {
        console.log(`❌ Erro na validação: ${error.message}`);
        
        if (error.message.includes('PKCS12')) {
            console.log('💡 Dica: Verifique se a senha do certificado está correta');
        }
    }
    
    console.log('\n✅ Validação completa do certificado concluída!');
}

// Executar validação
validateCertificateForSefaz().catch(console.error);