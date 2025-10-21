const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

/**
 * Gera um certificado A1 autoassinado de teste e exporta em formato PFX.
 * Apenas para validação de fluxo de carregamento (não serve para SEFAZ real).
 */
(async () => {
  try {
    const CERTS_DIR = path.join(__dirname, '..', 'certs');
    const OUT_PFX = path.join(CERTS_DIR, 'teste-a1.pfx');
    const PASS = process.env.CERT_PASS || '1234';

    if (!fs.existsSync(CERTS_DIR)) {
      fs.mkdirSync(CERTS_DIR, { recursive: true });
    }

    console.log('🔑 Gerando chave RSA 2048...');
    const keys = forge.pki.rsa.generateKeyPair(2048);

    console.log('📄 Criando certificado autoassinado...');
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;

    const now = new Date();
    const notBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000); // ontem
    const notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // +1 ano

    cert.serialNumber = (Math.floor(Math.random() * 1e16)).toString(16);
    cert.validity.notBefore = notBefore;
    cert.validity.notAfter = notAfter;

    const cnpj = process.env.CNPJ_EMITENTE || '12345678000195';

    const attrs = [
      { name: 'commonName', value: `EMPRESA TESTE CNPJ ${cnpj}` },
      { name: 'organizationName', value: 'Empresa Teste LTDA' },
      { name: 'countryName', value: 'BR' },
      { name: 'serialNumber', value: `CNPJ ${cnpj}` }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      { name: 'nsCertType', client: true },
    ]);

    console.log('✍️  Assinando certificado...');
    cert.sign(keys.privateKey, forge.md.sha256.create());

    console.log('📦 Empacotando em PKCS#12 (PFX)...');
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      [cert],
      PASS,
      { algorithm: '3des', count: 2048, saltSize: 8 }
    );

    const der = forge.asn1.toDer(p12Asn1).getBytes();
    fs.writeFileSync(OUT_PFX, Buffer.from(der, 'binary'));

    console.log('✅ Certificado PFX gerado com sucesso: ' + OUT_PFX);
    console.log('🔐 Senha do PFX: ' + PASS);
  } catch (err) {
    console.error('❌ Erro ao gerar PFX de teste:', err.message);
    process.exitCode = 1;
  }
})();