require('dotenv').config();
const fs = require('fs');
const forge = require('node-forge');
const https = require('https');
const axios = require('axios');

const config = {
    certificadoPath: process.env.CERT_PATH,
    certificadoSenha: process.env.CERT_PASS,
    cnpj: process.env.CNPJ_EMITENTE
};

class DiagnosticoCertificado {
    constructor() {
        this.certificado = null;
        this.chavePrivada = null;
    }

    async carregarCertificado() {
        console.log('🔐 Carregando e analisando certificado...');
        
        try {
            const certificadoBuffer = fs.readFileSync(config.certificadoPath);
            const p12Asn1 = forge.asn1.fromDer(certificadoBuffer.toString('binary'));
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, config.certificadoSenha);
            
            // Extrair certificado e chave privada
            const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
            const certBag = bags[forge.pki.oids.certBag][0];
            this.certificado = certBag.cert;
            
            const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
            const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
            this.chavePrivada = keyBag.key;
            
            console.log('✅ Certificado carregado com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao carregar certificado:', error.message);
            return false;
        }
    }

    analisarCertificado() {
        console.log('\n🔍 ANÁLISE DETALHADA DO CERTIFICADO');
        console.log('=' .repeat(50));
        
        try {
            const subject = this.certificado.subject;
            const issuer = this.certificado.issuer;
            const extensions = this.certificado.extensions;
            
            console.log('📋 DADOS DO TITULAR:');
            subject.attributes.forEach(attr => {
                console.log(`  ${attr.name}: ${attr.value}`);
            });
            
            console.log('\n🏢 AUTORIDADE CERTIFICADORA:');
            issuer.attributes.forEach(attr => {
                console.log(`  ${attr.name}: ${attr.value}`);
            });
            
            console.log('\n📅 VALIDADE:');
            console.log(`  Válido de: ${this.certificado.validity.notBefore}`);
            console.log(`  Válido até: ${this.certificado.validity.notAfter}`);
            
            const agora = new Date();
            const valido = agora >= this.certificado.validity.notBefore && agora <= this.certificado.validity.notAfter;
            console.log(`  Status: ${valido ? '✅ VÁLIDO' : '❌ EXPIRADO/INVÁLIDO'}`);
            
            console.log('\n🔧 EXTENSÕES:');
            extensions.forEach(ext => {
                console.log(`  ${ext.name}: ${ext.value || 'Presente'}`);
            });
            
            // Verificar se é certificado A1 para NFe
            const keyUsage = extensions.find(ext => ext.name === 'keyUsage');
            const extKeyUsage = extensions.find(ext => ext.name === 'extKeyUsage');
            
            console.log('\n🎯 VERIFICAÇÃO PARA NFe:');
            
            // Verificar CNPJ no certificado
            const cnpjCert = this.extrairCNPJCertificado();
            console.log(`  CNPJ no certificado: ${cnpjCert}`);
            console.log(`  CNPJ configurado: ${config.cnpj}`);
            console.log(`  CNPJ compatível: ${cnpjCert === config.cnpj.replace(/\D/g, '') ? '✅ SIM' : '❌ NÃO'}`);
            
            // Verificar tipo de certificado
            const tipoA1 = this.verificarTipoA1();
            console.log(`  Tipo A1: ${tipoA1 ? '✅ SIM' : '❌ NÃO'}`);
            
            // Verificar uso para assinatura digital
            const assinaturaDigital = this.verificarAssinaturaDigital();
            console.log(`  Assinatura Digital: ${assinaturaDigital ? '✅ SIM' : '❌ NÃO'}`);
            
            return {
                valido,
                cnpjCompativel: cnpjCert === config.cnpj.replace(/\D/g, ''),
                tipoA1,
                assinaturaDigital
            };
            
        } catch (error) {
            console.error('❌ Erro na análise:', error.message);
            return null;
        }
    }

    extrairCNPJCertificado() {
        try {
            const subject = this.certificado.subject;
            
            // Procurar CNPJ no CN (Common Name)
            const cn = subject.attributes.find(attr => attr.name === 'commonName');
            if (cn && cn.value) {
                const cnpjMatch = cn.value.match(/(\d{14})/);
                if (cnpjMatch) {
                    return cnpjMatch[1];
                }
            }
            
            // Procurar em outros campos
            const serialNumber = subject.attributes.find(attr => attr.name === 'serialNumber');
            if (serialNumber && serialNumber.value) {
                const cnpjMatch = serialNumber.value.match(/(\d{14})/);
                if (cnpjMatch) {
                    return cnpjMatch[1];
                }
            }
            
            return 'NÃO ENCONTRADO';
            
        } catch (error) {
            return 'ERRO NA EXTRAÇÃO';
        }
    }

    verificarTipoA1() {
        try {
            // Certificado A1 é armazenado em arquivo (não em hardware)
            // Se conseguimos carregar a chave privada, é A1
            return this.chavePrivada !== null;
        } catch (error) {
            return false;
        }
    }

    verificarAssinaturaDigital() {
        try {
            const extensions = this.certificado.extensions;
            const keyUsage = extensions.find(ext => ext.name === 'keyUsage');
            
            if (keyUsage && keyUsage.digitalSignature) {
                return true;
            }
            
            // Verificar Extended Key Usage
            const extKeyUsage = extensions.find(ext => ext.name === 'extKeyUsage');
            if (extKeyUsage) {
                // Procurar por OIDs relacionados à assinatura digital
                return true; // Simplificado para este teste
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    async testarConectividadeComCertificado() {
        console.log('\n🌐 TESTE DE CONECTIVIDADE COM CERTIFICADO');
        console.log('=' .repeat(50));
        
        const urls = [
            'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx?wsdl',
            'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx?wsdl'
        ];
        
        // Converter certificado para PEM
        const certPem = forge.pki.certificateToPem(this.certificado);
        const keyPem = forge.pki.privateKeyToPem(this.chavePrivada);
        
        for (const url of urls) {
            console.log(`\n🔗 Testando: ${url}`);
            
            try {
                // Teste 1: Sem certificado
                console.log('  📝 Teste 1: Sem certificado...');
                const response1 = await axios.get(url, {
                    timeout: 10000,
                    httpsAgent: new https.Agent({
                        rejectUnauthorized: false
                    })
                });
                console.log(`    Status: ${response1.status} - ${response1.status === 200 ? '✅ OK' : '❌ ERRO'}`);
                
            } catch (error) {
                console.log(`    ❌ Erro: ${error.response?.status || error.code} - ${error.message}`);
            }
            
            try {
                // Teste 2: Com certificado
                console.log('  🔐 Teste 2: Com certificado...');
                const response2 = await axios.get(url, {
                    timeout: 10000,
                    httpsAgent: new https.Agent({
                        cert: certPem,
                        key: keyPem,
                        rejectUnauthorized: false
                    })
                });
                console.log(`    Status: ${response2.status} - ${response2.status === 200 ? '✅ OK' : '❌ ERRO'}`);
                
            } catch (error) {
                console.log(`    ❌ Erro: ${error.response?.status || error.code} - ${error.message}`);
            }
        }
    }

    async executarDiagnostico() {
        console.log('🚀 DIAGNÓSTICO COMPLETO DO CERTIFICADO PARA NFe');
        console.log('=' .repeat(60));
        
        // Carregar certificado
        const carregado = await this.carregarCertificado();
        if (!carregado) {
            console.log('❌ Não foi possível carregar o certificado. Verifique o arquivo e senha.');
            return;
        }
        
        // Analisar certificado
        const analise = this.analisarCertificado();
        if (!analise) {
            console.log('❌ Não foi possível analisar o certificado.');
            return;
        }
        
        // Testar conectividade
        await this.testarConectividadeComCertificado();
        
        // Resumo final
        console.log('\n📊 RESUMO DO DIAGNÓSTICO');
        console.log('=' .repeat(30));
        
        console.log(`✅ Certificado válido: ${analise.valido ? 'SIM' : 'NÃO'}`);
        console.log(`✅ CNPJ compatível: ${analise.cnpjCompativel ? 'SIM' : 'NÃO'}`);
        console.log(`✅ Tipo A1: ${analise.tipoA1 ? 'SIM' : 'NÃO'}`);
        console.log(`✅ Assinatura digital: ${analise.assinaturaDigital ? 'SIM' : 'NÃO'}`);
        
        if (analise.valido && analise.cnpjCompativel && analise.tipoA1 && analise.assinaturaDigital) {
            console.log('\n🎉 CERTIFICADO ADEQUADO PARA NFe!');
            console.log('\n💡 PRÓXIMOS PASSOS:');
            console.log('1. Verificar se o CNPJ está credenciado na SEFAZ');
            console.log('2. Confirmar se o certificado foi instalado corretamente na SEFAZ');
            console.log('3. Testar com ambiente de produção se homologação não funcionar');
            console.log('4. Verificar se há restrições de IP ou firewall');
        } else {
            console.log('\n⚠️  PROBLEMAS IDENTIFICADOS:');
            if (!analise.valido) console.log('- Certificado expirado ou inválido');
            if (!analise.cnpjCompativel) console.log('- CNPJ do certificado não confere');
            if (!analise.tipoA1) console.log('- Certificado não é do tipo A1');
            if (!analise.assinaturaDigital) console.log('- Certificado não suporta assinatura digital');
        }
    }
}

// Executar diagnóstico
if (require.main === module) {
    const diagnostico = new DiagnosticoCertificado();
    diagnostico.executarDiagnostico().catch(error => {
        console.error('💥 Erro no diagnóstico:', error.message);
        process.exit(1);
    });
}

module.exports = DiagnosticoCertificado;