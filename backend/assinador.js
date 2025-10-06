const fs = require("fs");
const forge = require("node-forge");
const { SignedXml } = require("xml-crypto");
const { DOMParser } = require("xmldom");

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

// Assina o XML da NFe
function assinarNFe(xml, chavePrivada, certificado) {
    try {
        console.log("🔐 Iniciando assinatura XML...");
        
        // Para desenvolvimento, vamos retornar o XML sem assinatura
        // mas com uma estrutura de assinatura simulada
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true') {
            console.log("⚠️ Modo desenvolvimento: retornando XML sem assinatura digital");
            
            // Adiciona uma assinatura simulada para testes
            const xmlComAssinatura = xml.replace(
                '</infNFe>',
                `</infNFe>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="#NFe${Date.now()}">
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

        // Implementação real da assinatura para produção
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        
        if (!doc || doc.getElementsByTagName("parsererror").length > 0) {
            throw new Error("XML inválido para assinatura");
        }

        const infNFeElement = doc.getElementsByTagName("infNFe")[0];
        if (!infNFeElement) {
            throw new Error("Elemento infNFe não encontrado no XML");
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

        const idRef = infNFeElement.getAttribute("Id");
        if (!idRef) {
            throw new Error("Atributo Id não encontrado no elemento infNFe");
        }

        // Usa referência simples sem XPath complexo
        sig.addReference(`#${idRef}`);
        sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
        sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

        sig.computeSignature(xml);
        return sig.getSignedXml();

    } catch (error) {
        console.error("Erro na assinatura XML:", error);
        throw new Error(`Falha na assinatura: ${error.message}`);
    }
}

module.exports = { carregarCertificado, assinarNFe };

