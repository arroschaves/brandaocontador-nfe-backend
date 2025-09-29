const fs = require('fs');
const forge = require('node-forge');
const path = require('path');

/**
 * Script para converter certificado PFX para formato compatível
 * Resolve problemas de "Unsupported PKCS12 PFX data"
 */

const CERT_PASSWORD = '1234'; // Senha do certificado
const INPUT_CERT = 'certs/MAP LTDA45669746000120.pfx';
const OUTPUT_CERT = 'certs/MAP LTDA45669746000120_compatible.pfx';

async function convertCertificate() {
  try {
    console.log('🔄 Iniciando conversão do certificado...');
    
    // Verificar se o certificado original existe
    const inputPath = path.resolve(__dirname, INPUT_CERT);
    if (!fs.existsSync(inputPath)) {
      console.error(`❌ Certificado não encontrado: ${inputPath}`);
      console.log('💡 Coloque o certificado original na pasta certs/');
      return;
    }
    
    // Ler o certificado original
    const pfxData = fs.readFileSync(inputPath);
    console.log(`✅ Certificado lido: ${INPUT_CERT}`);
    
    // Converter para base64 e depois para forge
    const pfxBase64 = pfxData.toString('base64');
    const pfxAsn1 = forge.asn1.fromDer(forge.util.decode64(pfxBase64));
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, CERT_PASSWORD);
    
    console.log('✅ Certificado decodificado com sucesso');
    
    // Extrair chave privada e certificado
    const bags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    const privateKey = keyBag.key;
    
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag][0];
    const certificate = certBag.cert;
    
    console.log('✅ Chave privada e certificado extraídos');
    
    // Criar novo PKCS#12 compatível
    const newPfx = forge.pkcs12.toPkcs12Asn1(
      privateKey,
      [certificate],
      CERT_PASSWORD,
      {
        algorithm: '3des', // Usar 3DES para compatibilidade
        count: 2048,
        saltSize: 8
      }
    );
    
    // Converter para DER e salvar
    const newPfxDer = forge.asn1.toDer(newPfx).getBytes();
    const outputPath = path.resolve(__dirname, OUTPUT_CERT);
    
    // Criar diretório se não existir
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, Buffer.from(newPfxDer, 'binary'));
    
    console.log(`✅ Certificado compatível criado: ${OUTPUT_CERT}`);
    
    // Validar o certificado convertido
    console.log('🔍 Validando certificado convertido...');
    const validationResult = validateConvertedCert(outputPath);
    
    if (validationResult.valid) {
      console.log('✅ Certificado convertido é válido!');
      console.log(`📋 Subject: ${validationResult.subject}`);
      console.log(`📋 Issuer: ${validationResult.issuer}`);
      console.log(`📋 Válido de: ${validationResult.validFrom}`);
      console.log(`📋 Válido até: ${validationResult.validTo}`);
    } else {
      console.error('❌ Erro na validação do certificado convertido');
    }
    
  } catch (error) {
    console.error('❌ Erro na conversão:', error.message);
    console.error('🔍 Detalhes:', error);
  }
}

function validateConvertedCert(certPath) {
  try {
    const pfxData = fs.readFileSync(certPath);
    const pfxBase64 = pfxData.toString('base64');
    const pfxAsn1 = forge.asn1.fromDer(forge.util.decode64(pfxBase64));
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, CERT_PASSWORD);
    
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certificate = certBags[forge.pki.oids.certBag][0].cert;
    
    return {
      valid: true,
      subject: certificate.subject.getField('CN').value,
      issuer: certificate.issuer.getField('CN').value,
      validFrom: certificate.validity.notBefore.toISOString(),
      validTo: certificate.validity.notAfter.toISOString()
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Executar conversão
if (require.main === module) {
  convertCertificate();
}

module.exports = { convertCertificate, validateConvertedCert };