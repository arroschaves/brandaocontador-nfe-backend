#!/usr/bin/env node

/**
 * Script para criar um certificado de demonstração
 * ATENÇÃO: Este é apenas para testes! Use um certificado real em produção.
 */

const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

function createDemoCertificate() {
    console.log('Criando certificado de demonstração...');

    // Gerar par de chaves RSA
    console.log('Gerando chaves RSA...');
    const keys = forge.pki.rsa.generateKeyPair(2048);

    // Criar certificado
    console.log('Criando certificado...');
    const cert = forge.pki.createCertificate();
    
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    // Definir subject (titular do certificado)
    const attrs = [
        { name: 'commonName', value: 'EMPRESA DEMO LTDA' },
        { name: 'countryName', value: 'BR' },
        { name: 'stateOrProvinceName', value: 'São Paulo' },
        { name: 'localityName', value: 'São Paulo' },
        { name: 'organizationName', value: 'EMPRESA DEMO LTDA' },
        { shortName: 'OU', value: 'NFe Demo' }
    ];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Adicionar extensões
    cert.setExtensions([
        {
            name: 'basicConstraints',
            cA: false
        },
        {
            name: 'keyUsage',
            keyCertSign: false,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        },
        {
            name: 'extKeyUsage',
            clientAuth: true,
            emailProtection: true
        }
    ]);

    // Auto-assinar o certificado
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Criar arquivo PKCS#12 (PFX)
    console.log('Criando arquivo PFX...');
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
        keys.privateKey,
        cert,
        'demo123', // senha
        {
            generateLocalKeyId: true,
            friendlyName: 'Certificado Demo NFe'
        }
    );

    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

    // Salvar arquivo
    const certsDir = path.join(__dirname, '..', 'certs');
    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
    }

    const certPath = path.join(certsDir, 'certificado-demo.pfx');
    fs.writeFileSync(certPath, p12Der, 'binary');

    console.log('✅ Certificado de demonstração criado com sucesso!');
    console.log(`📁 Localização: ${certPath}`);
    console.log('🔑 Senha: demo123');
    console.log('');
    console.log('⚠️  ATENÇÃO: Este é um certificado de DEMONSTRAÇÃO!');
    console.log('   Para produção, use um certificado digital válido emitido por uma AC autorizada.');
    console.log('');
    console.log('Para usar este certificado, configure no .env:');
    console.log('CERT_PATH=./certs/certificado-demo.pfx');
    console.log('CERT_PASS=demo123');

    return {
        path: certPath,
        password: 'demo123'
    };
}

// Executar se chamado diretamente
if (require.main === module) {
    try {
        createDemoCertificate();
    } catch (error) {
        console.error('❌ Erro ao criar certificado:', error.message);
        process.exit(1);
    }
}

module.exports = { createDemoCertificate };