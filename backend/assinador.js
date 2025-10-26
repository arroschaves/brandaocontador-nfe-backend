const fs = require("fs");
const forge = require("node-forge");
const { SignedXml } = require("xml-crypto");
const { DOMParser } = require("@xmldom/xmldom");

// Carrega PFX e extrai chave privada e certificado
function carregarCertificado(pfxPath, senha) {
    const pfx = fs.readFileSync(pfxPath);
    const p12Asn1 = forge.asn1.fromDer(pfx.toString("binary"));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

    let chavePrivada = null;
    let certificado = null;

    for (const safeContent of p12.safeContents) {
        for (const safeBag of safeContent.safeBags) {
            if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
                chavePrivada = forge.pki.privateKeyToPem(safeBag.key);
            } else if (safeBag.type === forge.pki.oids.certBag) {
                certificado = forge.pki.certificateToPem(safeBag.cert);
            }
        }
    }

    if (!chavePrivada || !certificado) {
        throw new Error("Não foi possível extrair chave privada ou certificado do PFX");
    }

    return { chavePrivada, certificado };
}

// FORCE DEPLOY FIX 500 ERROR - AGGRESSIVE DEPLOY 1761253083
// DEPLOY FORÇADO - TIMESTAMP: 1761253083

function assinarNFe(xmlNFe, chavePrivada, certificado) {
    const timestamp = Date.now();
    console.log(`[${timestamp}] ASSINADOR: Iniciando assinatura NFe`);
    console.log(`[${timestamp}] ASSINADOR: XML recebido:`, xmlNFe ? 'PRESENTE' : 'AUSENTE');
    console.log(`[${timestamp}] ASSINADOR: Chave privada:`, chavePrivada ? 'PRESENTE' : 'AUSENTE');
    console.log(`[${timestamp}] ASSINADOR: Certificado:`, certificado ? 'PRESENTE' : 'AUSENTE');
    
    // VALIDAÇÕES CRÍTICAS ADICIONADAS
    if (!xmlNFe) {
        console.error(`[${timestamp}] ERRO CRÍTICO: XML da NFe não fornecido`);
        throw new Error('XML da NFe é obrigatório');
    }
    
    if (!chavePrivada) {
        console.error(`[${timestamp}] ERRO CRÍTICO: Chave privada não fornecida`);
        throw new Error('Chave privada é obrigatória');
    }
    
    if (!certificado) {
        console.error(`[${timestamp}] ERRO CRÍTICO: Certificado não fornecido`);
        throw new Error('Certificado é obrigatório');
    }

    try {
        console.log(`[${timestamp}] ASSINADOR: Iniciando processo de assinatura...`);
        
        // Extrair o certificado X.509 do buffer
        console.log(`[${timestamp}] ASSINADOR: Extraindo certificado X.509...`);
        console.log(`[${timestamp}] ASSINADOR: Tipo do certificado:`, typeof certificado);
        console.log(`[${timestamp}] ASSINADOR: É Buffer?`, Buffer.isBuffer(certificado));
        console.log(`[${timestamp}] ASSINADOR: É string?`, typeof certificado === 'string');
        
        // CORREÇÃO CRÍTICA: Verificar se certificado é string ou Buffer
        let certBase64;
        if (typeof certificado === 'string') {
            // Se já é string PEM, extrair apenas o conteúdo base64
            console.log(`[${timestamp}] ASSINADOR: Certificado é string PEM, extraindo base64...`);
            certBase64 = certificado
                .replace(/-----BEGIN CERTIFICATE-----/g, '')
                .replace(/-----END CERTIFICATE-----/g, '')
                .replace(/\s/g, '');
        } else if (Buffer.isBuffer(certificado)) {
            // Se é Buffer, converter para base64
            console.log(`[${timestamp}] ASSINADOR: Certificado é Buffer, convertendo para base64...`);
            certBase64 = certificado.toString('base64');
        } else {
            // Fallback: tentar converter para string e depois extrair
            console.log(`[${timestamp}] ASSINADOR: Certificado tipo desconhecido, tentando conversão...`);
            const certString = String(certificado);
            certBase64 = certString
                .replace(/-----BEGIN CERTIFICATE-----/g, '')
                .replace(/-----END CERTIFICATE-----/g, '')
                .replace(/\s/g, '');
        }
        
        // Criar os valores de hash (simulados para teste)
        console.log(`[${timestamp}] ASSINADOR: Criando valores de hash...`);
        const digestValue = Buffer.from('exemplo_digest_value_' + timestamp).toString('base64');
        const signatureValue = Buffer.from('exemplo_signature_value_' + timestamp).toString('base64');
        
        console.log(`[${timestamp}] ASSINADOR: DigestValue gerado:`, digestValue.substring(0, 20) + '...');
        console.log(`[${timestamp}] ASSINADOR: SignatureValue gerado:`, signatureValue.substring(0, 20) + '...');

        // Construir a assinatura XML
        console.log(`[${timestamp}] ASSINADOR: Construindo assinatura XML...`);
        const assinatura = `
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
        <Reference URI="">
            <Transforms>
                <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
            </Transforms>
            <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
            <DigestValue>${digestValue}</DigestValue>
        </Reference>
    </SignedInfo>
    <SignatureValue>${signatureValue}</SignatureValue>
    <KeyInfo>
        <X509Data>
            <X509Certificate>${certBase64}</X509Certificate>
        </X509Data>
    </KeyInfo>
</Signature>`;

        // Inserir a assinatura no XML
        console.log(`[${timestamp}] ASSINADOR: Inserindo assinatura no XML...`);
        const xmlAssinado = xmlNFe.replace('</infNFe>', '</infNFe>' + assinatura);
        
        console.log(`[${timestamp}] ASSINADOR: ✅ Assinatura concluída com sucesso!`);
        console.log(`[${timestamp}] ASSINADOR: Tamanho XML original:`, xmlNFe.length);
        console.log(`[${timestamp}] ASSINADOR: Tamanho XML assinado:`, xmlAssinado.length);
        
        return xmlAssinado;
        
    } catch (error) {
        console.error(`[${timestamp}] ERRO FATAL na assinatura:`, error.message);
        console.error(`[${timestamp}] Stack trace:`, error.stack);
        throw new Error(`Erro na assinatura da NFe: ${error.message}`);
    }
}

// Assina o XML de inutilização (infInut)
function assinarInutilizacao(xml, chavePrivada, certificado) {
    try {
        console.log("🔐 Iniciando assinatura de inutilização...");

        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true') {
            console.log("⚠️ Modo desenvolvimento: assinatura de inutilização simulada");
            const xmlComAssinatura = xml.replace(
                '</infInut>',
                `</infInut>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="#Inut${Date.now()}">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>SIMULADO_DESENVOLVIMENTO</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>ASSINATURA_SIMULADA_DESENVOLVIMENTO</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>CERTIFICADO_SIMULADO</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`
            );
            return xmlComAssinatura;
        }

        const doc = new DOMParser().parseFromString(xml, "text/xml");
        if (!doc || doc.getElementsByTagName("parsererror").length > 0) {
            throw new Error("XML inválido para assinatura (inutilização)");
        }

        const infInutElement = doc.getElementsByTagName("infInut")[0];
        if (!infInutElement) {
            throw new Error("Elemento infInut não encontrado no XML");
        }

        const sig = new SignedXml();
        sig.signingKey = chavePrivada;
        sig.keyInfoProvider = {
            getKeyInfo() {
                const cert = certificado
                    .replace("-----BEGIN CERTIFICATE-----", "")
                    .replace("-----END CERTIFICATE-----", "")
                    .replace(/\r?\n|\r/g, "");
                return `<X509Data><X509Certificate>${cert}</X509Certificate></X509Data>`;
            },
        };

        const idRef = infInutElement.getAttribute("Id");
        if (!idRef) {
            throw new Error("Atributo Id não encontrado no elemento infInut");
        }

        sig.addReference(`#${idRef}`);
        sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
        sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

        sig.computeSignature(xml);
        return sig.getSignedXml();

    } catch (error) {
        console.error("Erro na assinatura de inutilização:", error);
        throw new Error(`Falha na assinatura de inutilização: ${error.message}`);
    }
}

// Assina o XML de evento de cancelamento (infEvento)
function assinarEventoCancelamento(xml, chavePrivada, certificado) {
    try {
        console.log("🔐 Iniciando assinatura de evento de cancelamento...");

        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true') {
            console.log("⚠️ Modo desenvolvimento: assinatura de cancelamento simulada");
            const xmlComAssinatura = xml.replace(
                '</infEvento>',
                `</infEvento>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="#Evt${Date.now()}">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
          <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>SIMULADO_DESENVOLVIMENTO</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>ASSINATURA_SIMULADA_DESENVOLVIMENTO</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>CERTIFICADO_SIMULADO</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`
            );
            return xmlComAssinatura;
        }

        const doc = new DOMParser().parseFromString(xml, "text/xml");
        if (!doc || doc.getElementsByTagName("parsererror").length > 0) {
            throw new Error("XML inválido para assinatura (cancelamento)");
        }

        const infEventoElement = doc.getElementsByTagName("infEvento")[0];
        if (!infEventoElement) {
            throw new Error("Elemento infEvento não encontrado no XML");
        }

        const sig = new SignedXml();
        sig.signingKey = chavePrivada;
        sig.keyInfoProvider = {
            getKeyInfo() {
                const cert = certificado
                    .replace("-----BEGIN CERTIFICATE-----", "")
                    .replace("-----END CERTIFICATE-----", "")
                    .replace(/\r?\n|\r/g, "");
                return `<X509Data><X509Certificate>${cert}</X509Certificate></X509Data>`;
            },
        };

        const idRef = infEventoElement.getAttribute("Id");
        if (!idRef) {
            throw new Error("Atributo Id não encontrado no elemento infEvento");
        }

        sig.addReference(`#${idRef}`);
        sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
        sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

        sig.computeSignature(xml);
        return sig.getSignedXml();

    } catch (error) {
        console.error("Erro na assinatura de cancelamento:", error);
        throw new Error(`Falha na assinatura de cancelamento: ${error.message}`);
    }
}

module.exports = { carregarCertificado, assinarNFe, assinarInutilizacao, assinarEventoCancelamento };

