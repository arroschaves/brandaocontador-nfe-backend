const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');

class CertificateService {
    constructor() {
        this.certificateCache = new Map();
        this.fallbackPaths = [
            process.env.CERT_PATH,
            path.join(__dirname, '..', 'certs', 'certificado.pfx'),
            path.join(__dirname, '..', 'certs', 'cert.pfx'),
            path.join(__dirname, '..', 'certs', 'nfe.pfx')
        ].filter(Boolean);
    }

    /**
     * Carrega o certificado digital com sistema de fallback
     * @returns {Object} Certificado carregado
     */
    async loadCertificate() {
        const cacheKey = 'main_certificate';
        
        // Verifica cache primeiro
        if (this.certificateCache.has(cacheKey)) {
            const cached = this.certificateCache.get(cacheKey);
            if (this.isCertificateValid(cached)) {
                return cached;
            }
            this.certificateCache.delete(cacheKey);
        }

        let lastError = null;
        
        // Tenta carregar de cada caminho possível
        for (const certPath of this.fallbackPaths) {
            try {
                console.log(`Tentando carregar certificado de: ${certPath}`);
                
                if (!fs.existsSync(certPath)) {
                    
                    continue;
                }

                const certificate = await this.loadCertificateFromPath(certPath);
                
                if (this.isCertificateValid(certificate)) {
                    console.log(`Certificado carregado com sucesso de: ${certPath}`);
                    this.certificateCache.set(cacheKey, certificate);
                    return certificate;
                }
            } catch (error) {
                console.error(`Erro ao carregar certificado de ${certPath}:`, error.message);
                lastError = error;
            }
        }

        // Se chegou aqui, não conseguiu carregar nenhum certificado
        throw new Error(`Não foi possível carregar o certificado digital. Último erro: ${lastError?.message || 'Nenhum certificado encontrado'}`);
    }

    /**
     * Carrega certificado de um caminho específico
     * @param {string} certPath Caminho do certificado
     * @returns {Object} Certificado carregado
     */
    async loadCertificateFromPath(certPath, passwordOverride = null) {
        const certBuffer = fs.readFileSync(certPath);
        const password = (passwordOverride ?? process.env.CERT_PASS) || '';

        try {
            // Tenta carregar como PKCS#12 (PFX)
            const p12Asn1 = forge.asn1.fromDer(certBuffer.toString('binary'));
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
            
            // Extrai chave privada e certificado
            const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
            const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
            
            if (!keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || !certBags[forge.pki.oids.certBag]) {
                throw new Error('Certificado ou chave privada não encontrados no arquivo PFX');
            }

            const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
            const certificate = certBags[forge.pki.oids.certBag][0].cert;

            // Converte para PEM
            const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
            const certificatePem = forge.pki.certificateToPem(certificate);

            return {
                privateKey: privateKeyPem,
                certificate: certificatePem,
                x509Certificate: certificate,
                path: certPath,
                loadedAt: new Date(),
                expiresAt: certificate.validity.notAfter
            };
        } catch (error) {
            throw new Error(`Erro ao processar certificado PFX: ${error.message}`);
        }
    }

    /**
     * Verifica se o certificado é válido
     * @param {Object} certificate Certificado a ser validado
     * @returns {boolean} True se válido
     */
    isCertificateValid(certificate) {
        if (!certificate || !certificate.x509Certificate) {
            return false;
        }

        const now = new Date();
        const cert = certificate.x509Certificate;

        // Verifica se não expirou
        if (cert.validity.notAfter < now) {
            console.warn('Certificado expirado');
            return false;
        }

        // Verifica se já é válido
        if (cert.validity.notBefore > now) {
            console.warn('Certificado ainda não é válido');
            return false;
        }

        return true;
    }

    /**
     * Obtém informações do certificado
     * @param {Object} certificate Certificado
     * @returns {Object} Informações do certificado
     */
    getCertificateInfo(certificate) {
        if (!certificate || !certificate.x509Certificate) {
            return null;
        }

        const cert = certificate.x509Certificate;
        const subject = cert.subject.attributes;
        const issuer = cert.issuer.attributes;

        return {
            subject: {
                commonName: this.getAttributeValue(subject, 'commonName'),
                organizationName: this.getAttributeValue(subject, 'organizationName'),
                countryName: this.getAttributeValue(subject, 'countryName')
            },
            issuer: {
                commonName: this.getAttributeValue(issuer, 'commonName'),
                organizationName: this.getAttributeValue(issuer, 'organizationName')
            },
            validity: {
                notBefore: cert.validity.notBefore,
                notAfter: cert.validity.notAfter
            },
            serialNumber: cert.serialNumber,
            path: certificate.path
        };
    }

    /**
     * Obtém valor de um atributo do certificado
     * @param {Array} attributes Lista de atributos
     * @param {string} name Nome do atributo
     * @returns {string} Valor do atributo
     */
    getAttributeValue(attributes, name) {
        const attr = attributes.find(a => a.name === name || a.shortName === name);
        return attr ? attr.value : null;
    }

    /**
     * Verifica status do certificado
     * @returns {Object} Status do certificado
     */
    async getCertificateStatus() {
        try {
            const certificate = await this.loadCertificate();
            const info = this.getCertificateInfo(certificate);
            
            return {
                status: 'valid',
                info,
                message: 'Certificado carregado e válido'
            };
        } catch (error) {
            return {
                status: 'error',
                info: null,
                message: error.message,
                suggestions: [
                    'Verifique se o arquivo do certificado existe',
                    'Confirme se a senha do certificado está correta',
                    'Verifique se o certificado não expirou',
                    'Certifique-se de que o arquivo é um certificado PFX válido'
                ]
            };
        }
    }

    /**
     * Limpa cache de certificados
     */
    clearCache() {
        this.certificateCache.clear();
        console.log('Cache de certificados limpo');
    }
}

module.exports = CertificateService;