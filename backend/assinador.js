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
    const doc = new DOMParser().parseFromString(xml);
    const sig = new SignedXml();

    sig.signingKey = chavePrivada;

    sig.keyInfoProvider = {
        getKeyInfo() {
            return `<X509Data><X509Certificate>${certificado
                .replace("-----BEGIN CERTIFICATE-----", "")
                .replace("-----END CERTIFICATE-----", "")
                .replace(/\r?\n|\r/g, "")}</X509Certificate></X509Data>`;
        },
    };

    sig.addReference(
        "//*[local-name()='infNFe']",
        ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
        "http://www.w3.org/2000/09/xmldsig#sha1"
    );

    sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    sig.computeSignature(xml);

    return sig.getSignedXml();
}

module.exports = { carregarCertificado, assinarNFe };

