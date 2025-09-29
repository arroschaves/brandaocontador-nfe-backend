const fs = require('fs');
const https = require('https');
const axios = require('axios');
const forge = require('node-forge');
const crypto = require('crypto');
const path = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');
const CertificateService = require('./services/certificate-service');
require('dotenv').config();

// Configurações
const config = {
    ambiente: parseInt(process.env.AMBIENTE) || 2,
    uf: process.env.UF || 'SVRS',
    cnpj: process.env.CNPJ_EMITENTE,
    certificadoCaminho: process.env.CERT_PATH,
    certificadoSenha: process.env.CERT_PASS,
    timeout: parseInt(process.env.TIMEOUT) || 30000
};

// URLs dos webservices SEFAZ por ambiente e UF
const SEFAZ_URLS = {
    MS: {
        homologacao: 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4',
        producao: 'https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4'
    },
    SVRS: {
        homologacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        producao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
    }
};

class EmissorNFeAxios {
    constructor() {
        this.certificado = null;
        this.chavePrivada = null;
        this.certPem = null;
        this.keyPem = null;
        this.httpsAgent = null;
        this.certificateService = new CertificateService();
    }

    async inicializar() {
        console.log('🚀 Inicializando Emissor de NFe com Axios');
        console.log('='.repeat(50));
        
        console.log('\n📋 CONFIGURAÇÕES:');
        console.log(`UF: ${config.uf}`);
        console.log(`Ambiente: ${config.ambiente === 1 ? 'Produção' : 'Homologação'}`);
        console.log(`CNPJ: ${config.cnpj}`);
        console.log(`Certificado: ${config.certificadoCaminho}`);
        console.log(`Modo Simulação: ${process.env.SIMULATION_MODE === 'true' ? 'SIM' : 'NÃO'}`);
        
        if (process.env.SIMULATION_MODE === 'true') {
            console.log('\n⚠️  MODO SIMULAÇÃO ATIVADO - Certificado não será carregado');
            this.configurarHttpsAgentSimulacao();
        } else {
            await this.carregarCertificado();
            this.configurarHttpsAgent();
        }
    }

    async carregarCertificado() {
        console.log('\n🔐 Carregando certificado...');
        
        try {
            const certificadoCaminho = path.resolve(config.certificadoCaminho);
            console.log(`Tentando carregar certificado de: ${certificadoCaminho}`);
            
            if (!fs.existsSync(certificadoCaminho)) {
                throw new Error(`Arquivo de certificado não encontrado: ${certificadoCaminho}`);
            }
            
            const pfxBuffer = fs.readFileSync(certificadoCaminho);
            const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, config.certificadoSenha);
            
            // Extrair certificado e chave privada
            const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
            const certBag = bags[forge.pki.oids.certBag][0];
            
            const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
            const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
            
            this.certificado = certBag.cert;
            this.chavePrivada = keyBag.key;
            this.certPem = forge.pki.certificateToPem(certBag.cert);
            this.keyPem = forge.pki.privateKeyToPem(keyBag.key);
            
            console.log(`Certificado carregado com sucesso de: ${certificadoCaminho}`);
            console.log('✅ Certificado carregado com sucesso');
            console.log(`📅 Válido até: ${this.certificado.validity.notAfter}`);
            console.log(`👤 Titular: ${this.certificado.subject.getField('CN').value}`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar certificado:', error.message);
            throw error;
        }
    }

    configurarHttpsAgent() {
        console.log('\n🔗 Configurando agente HTTPS...');
        
        this.httpsAgent = new https.Agent({
            cert: this.certPem,
            key: this.keyPem,
            rejectUnauthorized: config.ambiente === 2 ? false : true
        });
        
        console.log('✅ Agente HTTPS configurado');
    }

    configurarHttpsAgentSimulacao() {
        console.log('\n🔗 Configurando agente HTTPS para simulação...');
        
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        
        console.log('✅ Agente HTTPS configurado para simulação');
    }

    gerarChaveAcesso() {
        const agora = new Date();
        const ano = agora.getFullYear().toString().substr(-2);
        const mes = (agora.getMonth() + 1).toString().padStart(2, '0');
        const cnpj = config.cnpj.padStart(14, '0');
        const modelo = '55';
        const serie = '001';
        const numero = '000000001';
        const tpEmis = '1';
        const codigo = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
        
        // Usar código numérico da UF - MS = 28
        const codigoUF = '28'; // 28=MS (Mato Grosso do Sul)
        
        const chaveBase = `${codigoUF}${ano}${mes}${cnpj}${modelo}${serie}${numero}${tpEmis}${codigo}`;
        console.log('🔑 Chave base (43 dígitos):', chaveBase, 'Tamanho:', chaveBase.length);
        
        if (chaveBase.length !== 43) {
            throw new Error(`Chave base deve ter 43 dígitos, mas tem ${chaveBase.length}`);
        }
        
        // Calcular dígito verificador
        const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let soma = 0;
        
        console.log('🔢 Calculando DV para chave:', chaveBase);
        
        for (let i = 0; i < chaveBase.length && i < pesos.length; i++) {
            const digito = parseInt(chaveBase[i]);
            if (isNaN(digito)) {
                throw new Error(`Dígito inválido na posição ${i}: ${chaveBase[i]}`);
            }
            soma += digito * pesos[i];
        }
        
        const resto = soma % 11;
        const dv = resto < 2 ? 0 : 11 - resto;
        console.log('🔢 DV calculado:', dv);
        
        const chaveCompleta = chaveBase + dv;
        console.log('🔑 Chave completa (44 dígitos):', chaveCompleta, 'Tamanho:', chaveCompleta.length);
        
        return {
            chaveAcesso: chaveCompleta,
            codigoNumerico: codigo
        };
    }

    gerarXMLNFe(dadosNFe) {
        console.log('📝 Gerando XML da NFe...');
        
        const { chaveAcesso, codigoNumerico } = this.gerarChaveAcesso(dadosNFe);
        
        // Usar dados fornecidos ou dados padrão de teste
        const emitente = dadosNFe?.emitente || {
            cnpj: '45669746000120',
            razaoSocial: 'EMPRESA TESTE LTDA',
            nomeFantasia: 'TESTE',
            endereco: {
                logradouro: 'RUA TESTE',
                numero: '123',
                bairro: 'CENTRO',
                codigoMunicipio: '5002704',
                nomeMunicipio: 'CAMPO GRANDE',
                uf: 'MS',
                cep: '79000000'
            },
            inscricaoEstadual: '123456789'
        };
        
        const destinatario = dadosNFe?.destinatario || {
            cpfCnpj: '12345678901',
            nome: 'CLIENTE TESTE',
            endereco: {
                logradouro: 'RUA CLIENTE',
                numero: '456',
                bairro: 'CENTRO',
                codigoMunicipio: '5002704',
                nomeMunicipio: 'CAMPO GRANDE',
                uf: 'MS',
                cep: '79000000'
            }
        };
        
        const itens = dadosNFe?.itens || [{
            codigo: '001',
            descricao: 'PRODUTO TESTE',
            ncm: '12345678',
            cfop: '5102',
            unidade: 'UN',
            quantidade: 1,
            valorUnitario: 100.00,
            valorTotal: 100.00
        }];
        
        // Calcular totais
        let vProd = 0, vICMS = 0, vPIS = 0, vCOFINS = 0;
        
        const itensXML = itens.map((item, index) => {
            const nItem = index + 1;
            const valorProduto = parseFloat(item.valorTotal || item.valorUnitario * item.quantidade);
            vProd += valorProduto;
            
            // Valores de impostos (exemplo)
            const valorICMS = valorProduto * 0.18; // 18% ICMS
            const valorPIS = valorProduto * 0.0165; // 1.65% PIS
            const valorCOFINS = valorProduto * 0.076; // 7.6% COFINS
            
            vICMS += valorICMS;
            vPIS += valorPIS;
            vCOFINS += valorCOFINS;
            
            return `
        <det nItem="${nItem}">
            <prod>
                <cProd>${item.codigo}</cProd>
                <cEAN>SEM GTIN</cEAN>
                <xProd>${item.descricao}</xProd>
                <NCM>${item.ncm}</NCM>
                <CFOP>${item.cfop}</CFOP>
                <uCom>${item.unidade}</uCom>
                <qCom>${item.quantidade.toFixed(4)}</qCom>
                <vUnCom>${item.valorUnitario.toFixed(7)}</vUnCom>
                <vProd>${valorProduto.toFixed(2)}</vProd>
                <cEANTrib>SEM GTIN</cEANTrib>
                <uTrib>${item.unidade}</uTrib>
                <qTrib>${item.quantidade.toFixed(4)}</qTrib>
                <vUnTrib>${item.valorUnitario.toFixed(10)}</vUnTrib>
                <indTot>1</indTot>
            </prod>
            <imposto>
                <ICMS>
                    <ICMS00>
                        <orig>0</orig>
                        <CST>00</CST>
                        <modBC>3</modBC>
                        <vBC>${valorProduto.toFixed(2)}</vBC>
                        <pICMS>18.00</pICMS>
                        <vICMS>${valorICMS.toFixed(2)}</vICMS>
                    </ICMS00>
                </ICMS>
                <PIS>
                    <PISAliq>
                        <CST>01</CST>
                        <vBC>${valorProduto.toFixed(2)}</vBC>
                        <pPIS>1.65</pPIS>
                        <vPIS>${valorPIS.toFixed(2)}</vPIS>
                    </PISAliq>
                </PIS>
                <COFINS>
                    <COFINSAliq>
                        <CST>01</CST>
                        <vBC>${valorProduto.toFixed(2)}</vBC>
                        <pCOFINS>7.60</pCOFINS>
                        <vCOFINS>${valorCOFINS.toFixed(2)}</vCOFINS>
                    </COFINSAliq>
                </COFINS>
            </imposto>
        </det>`;
        }).join('');
        
        const valorNF = vProd;
        
        const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${chaveAcesso}" versao="4.00">
        <ide>
            <cUF>50</cUF>
            <cNF>${codigoNumerico}</cNF>
            <natOp>VENDA</natOp>
            <mod>55</mod>
            <serie>1</serie>
            <nNF>1</nNF>
            <dhEmi>${new Date().toISOString().slice(0, 19)}-03:00</dhEmi>
            <tpNF>1</tpNF>
            <idDest>1</idDest>
            <cMunFG>5002704</cMunFG>
            <tpImp>1</tpImp>
            <tpEmis>1</tpEmis>
            <cDV>${chaveAcesso.slice(-1)}</cDV>
            <tpAmb>2</tpAmb>
            <finNFe>1</finNFe>
            <indFinal>1</indFinal>
            <indPres>1</indPres>
            <procEmi>0</procEmi>
            <verProc>1.0</verProc>
        </ide>
        <emit>
            <CNPJ>${emitente.cnpj}</CNPJ>
            <xNome>${emitente.razaoSocial}</xNome>
            <xFant>${emitente.nomeFantasia}</xFant>
            <enderEmit>
                <xLgr>${emitente.endereco.logradouro}</xLgr>
                <nro>${emitente.endereco.numero}</nro>
                <xBairro>${emitente.endereco.bairro}</xBairro>
                <cMun>${emitente.endereco.codigoMunicipio}</cMun>
                <xMun>${emitente.endereco.nomeMunicipio}</xMun>
                <UF>${emitente.endereco.uf}</UF>
                <CEP>${emitente.endereco.cep}</CEP>
                <cPais>1058</cPais>
                <xPais>BRASIL</xPais>
            </enderEmit>
            <IE>${emitente.inscricaoEstadual}</IE>
            <CRT>3</CRT>
        </emit>
        <dest>
            <CPF>${destinatario.cpfCnpj}</CPF>
            <xNome>${destinatario.nome}</xNome>
            <enderDest>
                <xLgr>${destinatario.endereco.logradouro}</xLgr>
                <nro>${destinatario.endereco.numero}</nro>
                <xBairro>${destinatario.endereco.bairro}</xBairro>
                <cMun>${destinatario.endereco.codigoMunicipio}</cMun>
                <xMun>${destinatario.endereco.nomeMunicipio}</xMun>
                <UF>${destinatario.endereco.uf}</UF>
                <CEP>${destinatario.endereco.cep}</CEP>
                <cPais>1058</cPais>
                <xPais>BRASIL</xPais>
            </enderDest>
            <indIEDest>9</indIEDest>
        </dest>${itensXML}
        <total>
            <ICMSTot>
                <vBC>${vProd.toFixed(2)}</vBC>
                <vICMS>${vICMS.toFixed(2)}</vICMS>
                <vICMSDeson>0.00</vICMSDeson>
                <vFCPUFDest>0.00</vFCPUFDest>
                <vICMSUFDest>0.00</vICMSUFDest>
                <vICMSUFRemet>0.00</vICMSUFRemet>
                <vFCP>0.00</vFCP>
                <vBCST>0.00</vBCST>
                <vST>0.00</vST>
                <vFCPST>0.00</vFCPST>
                <vFCPSTRet>0.00</vFCPSTRet>
                <vProd>${vProd.toFixed(2)}</vProd>
                <vFrete>0.00</vFrete>
                <vSeg>0.00</vSeg>
                <vDesc>0.00</vDesc>
                <vII>0.00</vII>
                <vIPI>0.00</vIPI>
                <vIPIDevol>0.00</vIPIDevol>
                <vPIS>${vPIS.toFixed(2)}</vPIS>
                <vCOFINS>${vCOFINS.toFixed(2)}</vCOFINS>
                <vOutro>0.00</vOutro>
                <vNF>${valorNF.toFixed(2)}</vNF>
            </ICMSTot>
        </total>
        <transp>
            <modFrete>9</modFrete>
        </transp>
        <pag>
            <detPag>
                <indPag>1</indPag>
                <tPag>01</tPag>
                <vPag>${valorNF.toFixed(2)}</vPag>
            </detPag>
        </pag>
    </infNFe>
</NFe>`;
        
        console.log('✅ XML da NFe gerado');
        return { xml, chaveAcesso };
    }

    gerarXMLConsulta(chave) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
    <tpAmb>${process.env.AMBIENTE}</tpAmb>
    <xServ>CONSULTAR</xServ>
    <chNFe>${chave}</chNFe>
</consSitNFe>`;
    }
    
    gerarXMLCancelamento(chave, justificativa) {
        const sequencial = '001';
        const cnpj = process.env.CNPJ_EMITENTE.replace(/\D/g, '');
        const dataHora = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
    <idLote>1</idLote>
    <evento versao="1.00">
        <infEvento Id="ID110111${chave}${sequencial}">
            <cOrgao>28</cOrgao>
            <tpAmb>${process.env.AMBIENTE}</tpAmb>
            <CNPJ>${cnpj}</CNPJ>
            <chNFe>${chave}</chNFe>
            <dhEvento>${dataHora}</dhEvento>
            <tpEvento>110111</tpEvento>
            <nSeqEvento>${sequencial}</nSeqEvento>
            <verEvento>1.00</verEvento>
            <detEvento versao="1.00">
                <descEvento>Cancelamento</descEvento>
                <nProt>123456789012345</nProt>
                <xJust>${justificativa}</xJust>
            </detEvento>
        </infEvento>
    </evento>
</envEvento>`;
    }

    assinarXML(xml) {
        console.log('\n🔐 Assinando XML...');
        
        // Modo simulação - retorna XML sem assinatura
        if (process.env.SIMULATION_MODE === 'true') {
            console.log('⚠️  MODO SIMULAÇÃO - XML não será assinado digitalmente');
            
            // Adicionar assinatura simulada para validação de estrutura
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const serializer = new XMLSerializer();
            
            const infNFe = doc.getElementsByTagName('infNFe')[0];
            const infNFeId = infNFe.getAttribute('Id');
            
            // Criar assinatura simulada
            const signatureSimulada = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
                <SignedInfo>
                    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
                    <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1" />
                    <Reference URI="#${infNFeId}">
                        <Transforms>
                            <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
                            <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
                        </Transforms>
                        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1" />
                        <DigestValue>SIMULACAO_DIGEST_VALUE</DigestValue>
                    </Reference>
                </SignedInfo>
                <SignatureValue>SIMULACAO_SIGNATURE_VALUE</SignatureValue>
                <KeyInfo>
                    <X509Data>
                        <X509Certificate>SIMULACAO_CERTIFICATE</X509Certificate>
                    </X509Data>
                </KeyInfo>
            </Signature>`;
            
            const nfeElement = doc.getElementsByTagName('NFe')[0];
            const signatureElement = parser.parseFromString(signatureSimulada, 'text/xml').documentElement;
            nfeElement.appendChild(signatureElement);
            
            const xmlSimulado = serializer.serializeToString(doc);
            console.log('✅ XML com assinatura simulada gerado');
            return xmlSimulado;
        }
        
        // Modo normal - verificar se chave privada está carregada
        if (!this.keyPem) {
            throw new Error('Chave privada não carregada. Configure o certificado digital ou ative SIMULATION_MODE=true');
        }
        
        // Modo normal - assinatura real
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            
            // Encontrar o elemento infNFe
            const infNFe = doc.getElementsByTagName('infNFe')[0];
            const infNFeId = infNFe.getAttribute('Id');
            
            // Canonicalizar o elemento infNFe
            const serializer = new XMLSerializer();
            const infNFeXml = serializer.serializeToString(infNFe);
            
            // Calcular hash SHA1
            const hash = crypto.createHash('sha1');
            hash.update(infNFeXml, 'utf8');
            const digestValue = hash.digest('base64');
            
            // Criar SignedInfo
            const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
                <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
                <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1" />
                <Reference URI="#${infNFeId}">
                    <Transforms>
                        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
                        <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
                    </Transforms>
                    <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1" />
                    <DigestValue>${digestValue}</DigestValue>
                </Reference>
            </SignedInfo>`;
            
            // Assinar SignedInfo
            const sign = crypto.createSign('RSA-SHA1');
            sign.update(signedInfo, 'utf8');
            
            const signatureValue = sign.sign(this.keyPem, 'base64');
            
            // Obter certificado em base64
            const certBase64 = this.certPem
                .replace('-----BEGIN CERTIFICATE-----', '')
                .replace('-----END CERTIFICATE-----', '')
                .replace(/\n/g, '');
            
            // Criar elemento Signature
            const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
                ${signedInfo}
                <SignatureValue>${signatureValue}</SignatureValue>
                <KeyInfo>
                    <X509Data>
                        <X509Certificate>${certBase64}</X509Certificate>
                    </X509Data>
                </KeyInfo>
            </Signature>`;
            
            // Inserir assinatura no XML
            const nfeElement = doc.getElementsByTagName('NFe')[0];
            const signatureElement = parser.parseFromString(signature, 'text/xml').documentElement;
            nfeElement.appendChild(signatureElement);
            
            const xmlAssinado = serializer.serializeToString(doc);
            
            console.log('✅ XML assinado com sucesso');
            
            return xmlAssinado;
            
        } catch (error) {
            console.error('❌ Erro ao assinar XML:', error.message);
            throw error;
        }
    }

    criarEnvelopeSOAP(xmlAssinado, cUF, versaoDados, servico = 'NFeAutorizacao4') {
        // Remove declaração XML duplicada se existir
        const xmlLimpo = xmlAssinado.replace(/<\?xml[^>]*\?>/g, '');
        
        return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <soap:Header>
        <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">
            <cUF>${cUF}</cUF>
            <versaoDados>${versaoDados}</versaoDados>
        </nfeCabecMsg>
    </soap:Header>
    <soap:Body>
        <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">
            ${xmlLimpo}
        </nfeDadosMsg>
    </soap:Body>
</soap:Envelope>`;
    }

    gerarEnvelopeEnviNFe(nfeXML, idLote = '1') {
        return `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>${idLote}</idLote>
  <indSinc>1</indSinc>
  ${nfeXML}
</enviNFe>`;
    }

    async enviarNFe(xmlAssinado) {
        console.log('\n📤 Enviando NFe para SEFAZ...');
        
        // Modo simulação - retorna resposta simulada
        if (process.env.SIMULATION_MODE === 'true') {
            console.log('⚠️  MODO SIMULAÇÃO - NFe não será enviada para SEFAZ real');
            
            // Simular processamento
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Resposta simulada de sucesso
            const respostaSimulada = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
    <soap:Body>
        <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
            <retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
                <tpAmb>2</tpAmb>
                <verAplic>SIMULACAO_1.0</verAplic>
                <cStat>100</cStat>
                <xMotivo>Autorizado o uso da NF-e</xMotivo>
                <cUF>50</cUF>
                <dhRecbto>2024-01-01T10:00:00-03:00</dhRecbto>
                <protNFe versao="4.00">
                    <infProt>
                        <tpAmb>2</tpAmb>
                        <verAplic>SIMULACAO_1.0</verAplic>
                        <chNFe>50240145669746000120550010000000011000000001</chNFe>
                        <dhRecbto>2024-01-01T10:00:00-03:00</dhRecbto>
                        <nProt>150240000000001</nProt>
                        <digVal>SIMULACAO_DIGEST</digVal>
                        <cStat>100</cStat>
                        <xMotivo>Autorizado o uso da NF-e</xMotivo>
                    </infProt>
                </protNFe>
            </retEnviNFe>
        </nfeResultMsg>
    </soap:Body>
</soap:Envelope>`;
            
            console.log('✅ Resposta simulada gerada');
            console.log('📊 Status simulado: 100 - Autorizado o uso da NF-e');
            
            return this.processarResposta(respostaSimulada);
        }
        
        // Modo normal - envio real para SEFAZ
        try {
            const ambiente = config.ambiente === 1 ? 'producao' : 'homologacao';
            const url = SEFAZ_URLS['MS'][ambiente];
            
            const envelope = this.criarEnvelopeSOAP(xmlAssinado, '50', '4.00');
            
            const headers = {
                 'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
                 'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote'
             };
            
            console.log(`🌐 URL: ${url}`);
            console.log('📋 Headers:', headers);
            console.log('📋 SOAP Envelope (primeiros 500 chars):', envelope.substring(0, 500));
            
            const response = await axios.post(url, envelope, {
                headers,
                httpsAgent: this.httpsAgent,
                timeout: config.timeout,
                validateStatus: function (status) {
                    return status < 500; // Aceitar códigos de erro para debug
                }
            });
            
            console.log('✅ Resposta recebida da SEFAZ');
            console.log(`📊 Status HTTP: ${response.status}`);
            console.log('📊 Headers de resposta:', response.headers);
            console.log('📊 Dados da resposta (primeiros 1000 chars):', 
                typeof response.data === 'string' ? response.data.substring(0, 1000) : JSON.stringify(response.data).substring(0, 1000));
            
            if (response.status !== 200) {
                console.log('❌ Erro HTTP:', response.status);
                console.log('❌ Resposta completa:', response.data);
                throw new Error(`Erro HTTP ${response.status}: ${response.data}`);
            }
            
            return this.processarResposta(response.data);
            
        } catch (error) {
            console.error('❌ Erro ao enviar NFe:', error.message);
            if (error.response) {
                console.error(`Status: ${error.response.status}`);
                console.error('Headers de resposta:', error.response.headers);
                console.error('Data completa:', typeof error.response.data === 'string' ? 
                    error.response.data.substring(0, 1000) : error.response.data);
            }
            throw error;
        }
    }

    processarResposta(responseData) {
        console.log('\n📋 Processando resposta da SEFAZ...');
        
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(responseData, 'text/xml');
            
            // Extrair informações da resposta
            const cStat = doc.getElementsByTagName('cStat')[0]?.textContent;
            const xMotivo = doc.getElementsByTagName('xMotivo')[0]?.textContent;
            const nRec = doc.getElementsByTagName('nRec')[0]?.textContent;
            
            console.log(`📊 Status: ${cStat}`);
            console.log(`📝 Motivo: ${xMotivo}`);
            if (nRec) console.log(`🎫 Recibo: ${nRec}`);
            
            return {
                status: cStat,
                motivo: xMotivo,
                recibo: nRec,
                xmlResposta: responseData
            };
            
        } catch (error) {
            console.error('❌ Erro ao processar resposta:', error.message);
            return {
                status: 'ERRO',
                motivo: 'Erro ao processar resposta',
                xmlResposta: responseData
            };
        }
    }

    async salvarXML(xml, tipo = 'nfe') {
        if (process.env.SAVE_XML_FILES === 'true') {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${tipo}_${timestamp}.xml`;
            const filepath = `./xmls/${filename}`;
            
            // Criar diretório se não existir
            if (!fs.existsSync('./xmls')) {
                fs.mkdirSync('./xmls', { recursive: true });
            }
            
            fs.writeFileSync(filepath, xml);
            console.log(`💾 XML salvo: ${filepath}`);
        }
    }

    async emitirNFe(dadosNFe) {
        try {
            console.log('🚀 Iniciando emissão de NFe via Axios...');
            
            // Gerar XML da NFe
            const { xml, chaveAcesso } = this.gerarXMLNFe(dadosNFe);
            
            // Assinar XML
            const xmlAssinado = this.assinarXML(xml);
            
            // Salvar XML se configurado
            if (process.env.SAVE_XML_FILES === 'true') {
                await this.salvarXML(xmlAssinado, `${chaveAcesso || 'temp'}-nfe`);
            }
            
            // Enviar para SEFAZ
            const resultado = await this.enviarNFe(xmlAssinado);
            
            return resultado;
            
        } catch (error) {
            console.error('❌ Erro na emissão:', error.message);
            throw error;
        }
    }
    
    async consultarNFe(chave) {
        try {
            console.log(`🔍 Consultando NFe: ${chave}`);
            
            const xmlConsulta = this.gerarXMLConsulta(chave);
            const xmlAssinado = this.assinarXML(xmlConsulta);
            
            const envelope = this.criarEnvelopeSOAP(xmlAssinado, '28', '4.00', 'NfeConsultaProtocolo');
            
            const ambiente = config.ambiente === 1 ? 'producao' : 'homologacao';
            const url = SEFAZ_URLS['MS'][ambiente].replace('NFeAutorizacao4', 'NFeConsultaProtocolo4');
            
            const response = await axios.post(url, envelope, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF'
                },
                httpsAgent: this.httpsAgent,
                timeout: config.timeout
            });
            
            return this.processarResposta(response.data);
            
        } catch (error) {
            console.error('❌ Erro na consulta:', error.message);
            throw error;
        }
    }
    
    async cancelarNFe(chave, justificativa) {
        try {
            console.log(`🚫 Cancelando NFe: ${chave}`);
            
            const xmlCancelamento = this.gerarXMLCancelamento(chave, justificativa);
            const xmlAssinado = this.assinarXML(xmlCancelamento);
            
            const envelope = this.criarEnvelopeSOAP(xmlAssinado, '28', '4.00', 'RecepcaoEvento');
            
            const ambiente = config.ambiente === 1 ? 'producao' : 'homologacao';
            const url = SEFAZ_URLS['MS'][ambiente].replace('NFeAutorizacao4', 'NFeRecepcaoEvento4');
            
            const response = await axios.post(url, envelope, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento'
                },
                httpsAgent: this.httpsAgent,
                timeout: config.timeout
            });
            
            return this.processarResposta(response.data);
            
        } catch (error) {
            console.error('❌ Erro no cancelamento:', error.message);
            throw error;
        }
    }
}

// Função de teste
async function testarEmissaoNFe() {
    try {
        console.log('🚀 TESTE DE EMISSÃO DE NFe COM AXIOS');
        console.log('=' .repeat(50));
        
        const emissor = new EmissorNFeAxios();
        await emissor.inicializar();
        
        const resultado = await emissor.emitirNFe();
        
        console.log('\n✅ Teste concluído com sucesso!');
        return resultado;
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        throw error;
    }
}

if (require.main === module) {
    testarEmissaoNFe()
        .then(() => console.log('\n✅ Teste de emissão completo!'))
        .catch(error => console.error('❌ Falha no teste:', error.message));
}

module.exports = { EmissorNFeAxios };