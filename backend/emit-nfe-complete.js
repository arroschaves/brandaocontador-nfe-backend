const soap = require('soap');
const fs = require('fs');
const path = require('path');
const https = require('https');
const forge = require('node-forge');
const crypto = require('crypto');
require('dotenv').config();

const wsUrls = require('./ws_urls_uf');

class NFeEmitter {
    constructor() {
        this.config = {
            uf: process.env.UF || 'SP',
            ambiente: process.env.AMBIENTE || '2',
            certPath: process.env.CERT_PATH,
            certPassword: process.env.CERT_PASS,
            cnpjEmitente: process.env.CNPJ_EMITENTE,
            timeout: parseInt(process.env.TIMEOUT) || 30000
        };
        
        this.pfxBuffer = null;
        this.privateKey = null;
        this.certificate = null;
        this.soapClient = null;
    }
    
    async initialize() {
        console.log('🚀 Inicializando Emissor de NFe');
        console.log('==============================\n');
        
        console.log('📋 CONFIGURAÇÕES:');
        console.log(`UF: ${this.config.uf}`);
        console.log(`Ambiente: ${this.config.ambiente === '1' ? 'Produção' : 'Homologação'}`);
        console.log(`CNPJ: ${this.config.cnpjEmitente}`);
        console.log(`Certificado: ${this.config.certPath}\n`);
        
        // 1. Carregar certificado
        await this.loadCertificate();
        
        // 2. Criar cliente SOAP
        await this.createSoapClient();
        
        console.log('✅ Emissor inicializado com sucesso!\n');
    }
    
    async loadCertificate() {
        console.log('🔐 Carregando certificado...');
        
        try {
            this.pfxBuffer = fs.readFileSync(this.config.certPath);
            
            // Decodificar PFX
            const p12Asn1 = forge.asn1.fromDer(this.pfxBuffer.toString('binary'));
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.config.certPassword);
            
            // Extrair chave privada
            const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
            this.privateKey = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
            
            // Extrair certificado
            const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
            this.certificate = certBags[forge.pki.oids.certBag][0].cert;
            
            console.log('✅ Certificado carregado com sucesso');
            
        } catch (error) {
            throw new Error(`Erro ao carregar certificado: ${error.message}`);
        }
    }
    
    async createSoapClient() {
        console.log('🔗 Criando cliente SOAP...');
        
        const wsdlUrl = wsUrls[this.config.uf] && wsUrls[this.config.uf][this.config.ambiente];
        if (!wsdlUrl) {
            throw new Error(`URL WSDL não encontrada para UF: ${this.config.uf}`);
        }
        
        console.log(`URL: ${wsdlUrl}`);
        
        try {
            const soapOptions = {
                timeout: this.config.timeout,
                httpsAgent: new https.Agent({
                    pfx: this.pfxBuffer,
                    passphrase: this.config.certPassword,
                    rejectUnauthorized: false // Para homologação
                }),
                headers: {
                    'User-Agent': 'NFe-Emitter/1.0',
                    'Content-Type': 'text/xml; charset=utf-8'
                }
            };
            
            this.soapClient = await soap.createClientAsync(wsdlUrl, soapOptions);
            console.log('✅ Cliente SOAP criado com sucesso');
            
        } catch (error) {
            throw new Error(`Erro ao criar cliente SOAP: ${error.message}`);
        }
    }
    
    generateNFeXML(dadosNFe) {
        console.log('📄 Gerando XML da NFe...');
        
        const now = new Date();
        const dhEmi = now.toISOString().slice(0, 19) + '-03:00';
        const cNF = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
        const nNF = dadosNFe.numero || '1';
        const serie = dadosNFe.serie || '1';
        
        // Chave de acesso (simplificada para teste)
        const chaveAcesso = this.generateChaveAcesso({
            cUF: this.config.uf === 'SP' ? '35' : '43',
            AAMM: now.getFullYear().toString().slice(2) + (now.getMonth() + 1).toString().padStart(2, '0'),
            CNPJ: this.config.cnpjEmitente,
            mod: '55',
            serie: serie.padStart(3, '0'),
            nNF: nNF.padStart(9, '0'),
            tpEmis: '1',
            cNF: cNF
        });
        
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${chaveAcesso}" versao="4.00">
        <ide>
            <cUF>${this.config.uf === 'SP' ? '35' : '43'}</cUF>
            <cNF>${cNF}</cNF>
            <natOp>Venda de mercadoria</natOp>
            <mod>55</mod>
            <serie>${serie}</serie>
            <nNF>${nNF}</nNF>
            <dhEmi>${dhEmi}</dhEmi>
            <tpNF>1</tpNF>
            <idDest>2</idDest>
            <cMunFG>3550308</cMunFG>
            <tpImp>1</tpImp>
            <tpEmis>1</tpEmis>
            <cDV>${chaveAcesso.slice(-1)}</cDV>
            <tpAmb>${this.config.ambiente}</tpAmb>
            <finNFe>1</finNFe>
            <indFinal>1</indFinal>
            <indPres>1</indPres>
            <procEmi>0</procEmi>
            <verProc>1.0</verProc>
        </ide>
        <emit>
            <CNPJ>${this.config.cnpjEmitente}</CNPJ>
            <xNome>${dadosNFe.emitente?.nome || 'MAP LTDA'}</xNome>
            <enderEmit>
                <xLgr>${dadosNFe.emitente?.endereco?.logradouro || 'Rua Teste'}</xLgr>
                <nro>${dadosNFe.emitente?.endereco?.numero || '123'}</nro>
                <xBairro>${dadosNFe.emitente?.endereco?.bairro || 'Centro'}</xBairro>
                <cMun>3550308</cMun>
                <xMun>São Paulo</xMun>
                <UF>SP</UF>
                <CEP>${dadosNFe.emitente?.endereco?.cep || '01000000'}</CEP>
                <cPais>1058</cPais>
                <xPais>Brasil</xPais>
            </enderEmit>
            <IE>${dadosNFe.emitente?.ie || 'ISENTO'}</IE>
            <CRT>3</CRT>
        </emit>
        <dest>
            <CPF>${dadosNFe.destinatario?.cpf || '12345678901'}</CPF>
            <xNome>${dadosNFe.destinatario?.nome || 'Cliente Teste'}</xNome>
            <enderDest>
                <xLgr>${dadosNFe.destinatario?.endereco?.logradouro || 'Rua Cliente'}</xLgr>
                <nro>${dadosNFe.destinatario?.endereco?.numero || '456'}</nro>
                <xBairro>${dadosNFe.destinatario?.endereco?.bairro || 'Bairro'}</xBairro>
                <cMun>3550308</cMun>
                <xMun>São Paulo</xMun>
                <UF>SP</UF>
                <CEP>${dadosNFe.destinatario?.endereco?.cep || '02000000'}</CEP>
                <cPais>1058</cPais>
                <xPais>Brasil</xPais>
            </enderDest>
            <indIEDest>9</indIEDest>
        </dest>
        <det nItem="1">
            <prod>
                <cProd>001</cProd>
                <cEAN></cEAN>
                <xProd>${dadosNFe.itens?.[0]?.descricao || 'Produto Teste'}</xProd>
                <NCM>12345678</NCM>
                <CFOP>5102</CFOP>
                <uCom>UN</uCom>
                <qCom>${dadosNFe.itens?.[0]?.quantidade || '1.0000'}</qCom>
                <vUnCom>${dadosNFe.itens?.[0]?.valorUnitario || '10.00'}</vUnCom>
                <vProd>${dadosNFe.itens?.[0]?.valorTotal || '10.00'}</vProd>
                <cEANTrib></cEANTrib>
                <uTrib>UN</uTrib>
                <qTrib>${dadosNFe.itens?.[0]?.quantidade || '1.0000'}</qTrib>
                <vUnTrib>${dadosNFe.itens?.[0]?.valorUnitario || '10.00'}</vUnTrib>
                <indTot>1</indTot>
            </prod>
            <imposto>
                <ICMS>
                    <ICMS00>
                        <orig>0</orig>
                        <CST>00</CST>
                        <modBC>3</modBC>
                        <vBC>${dadosNFe.itens?.[0]?.valorTotal || '10.00'}</vBC>
                        <pICMS>18.00</pICMS>
                        <vICMS>1.80</vICMS>
                    </ICMS00>
                </ICMS>
                <PIS>
                    <PISAliq>
                        <CST>01</CST>
                        <vBC>${dadosNFe.itens?.[0]?.valorTotal || '10.00'}</vBC>
                        <pPIS>1.65</pPIS>
                        <vPIS>0.17</vPIS>
                    </PISAliq>
                </PIS>
                <COFINS>
                    <COFINSAliq>
                        <CST>01</CST>
                        <vBC>${dadosNFe.itens?.[0]?.valorTotal || '10.00'}</vBC>
                        <pCOFINS>7.60</pCOFINS>
                        <vCOFINS>0.76</vCOFINS>
                    </COFINSAliq>
                </COFINS>
            </imposto>
        </det>
        <total>
            <ICMSTot>
                <vBC>10.00</vBC>
                <vICMS>1.80</vICMS>
                <vICMSDeson>0.00</vICMSDeson>
                <vFCP>0.00</vFCP>
                <vBCST>0.00</vBCST>
                <vST>0.00</vST>
                <vFCPST>0.00</vFCPST>
                <vFCPSTRet>0.00</vFCPSTRet>
                <vProd>10.00</vProd>
                <vFrete>0.00</vFrete>
                <vSeg>0.00</vSeg>
                <vDesc>0.00</vDesc>
                <vII>0.00</vII>
                <vIPI>0.00</vIPI>
                <vIPIDevol>0.00</vIPIDevol>
                <vPIS>0.17</vPIS>
                <vCOFINS>0.76</vCOFINS>
                <vOutro>0.00</vOutro>
                <vNF>10.00</vNF>
            </ICMSTot>
        </total>
        <transp>
            <modFrete>9</modFrete>
        </transp>
        <pag>
            <detPag>
                <tPag>01</tPag>
                <vPag>10.00</vPag>
            </detPag>
        </pag>
        <infAdic>
            <infCpl>NFe emitida em ambiente de homologacao - SEM VALOR FISCAL</infCpl>
        </infAdic>
    </infNFe>
</NFe>`;
        
        console.log('✅ XML gerado com sucesso');
        return { xml, chaveAcesso };
    }
    
    generateChaveAcesso(dados) {
        // Gerar chave de acesso simplificada
        const chave = dados.cUF + dados.AAMM + dados.CNPJ + dados.mod + dados.serie + dados.nNF + dados.tpEmis + dados.cNF;
        
        // Calcular dígito verificador (algoritmo simplificado)
        let soma = 0;
        let peso = 2;
        
        for (let i = chave.length - 1; i >= 0; i--) {
            soma += parseInt(chave[i]) * peso;
            peso++;
            if (peso > 9) peso = 2;
        }
        
        const resto = soma % 11;
        const dv = resto < 2 ? 0 : 11 - resto;
        
        return chave + dv;
    }
    
    signXML(xml) {
        console.log('✍️  Assinando XML...');
        
        try {
            // Criar hash do XML
            const hash = crypto.createHash('sha1').update(xml, 'utf8').digest('base64');
            
            // Assinar hash com chave privada
            const signature = this.privateKey.sign(forge.md.sha1.create().update(xml, 'utf8'));
            const signatureBase64 = forge.util.encode64(signature);
            
            // Obter certificado em base64
            const certPem = forge.pki.certificateToPem(this.certificate);
            const certBase64 = certPem.replace(/-----BEGIN CERTIFICATE-----\n/, '')
                                    .replace(/\n-----END CERTIFICATE-----/, '')
                                    .replace(/\n/g, '');
            
            // Adicionar assinatura ao XML
            const signedXml = xml.replace('</NFe>', `
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        <SignedInfo>
            <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
            <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1" />
            <Reference URI="">
                <Transforms>
                    <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
                    <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
                </Transforms>
                <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1" />
                <DigestValue>${hash}</DigestValue>
            </Reference>
        </SignedInfo>
        <SignatureValue>${signatureBase64}</SignatureValue>
        <KeyInfo>
            <X509Data>
                <X509Certificate>${certBase64}</X509Certificate>
            </X509Data>
        </KeyInfo>
    </Signature>
</NFe>`);
            
            console.log('✅ XML assinado com sucesso');
            return signedXml;
            
        } catch (error) {
            throw new Error(`Erro ao assinar XML: ${error.message}`);
        }
    }
    
    async sendToSefaz(xmlAssinado) {
        console.log('📤 Enviando NFe para SEFAZ...');
        
        try {
            const method = this.soapClient.NFeAutorizacao || this.soapClient.nfeAutorizacaoLote || this.soapClient.NfeAutorizacao;
            
            if (!method) {
                throw new Error('Método de autorização não encontrado no WSDL');
            }
            
            const loteXml = `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
    <idLote>1</idLote>
    <indSinc>1</indSinc>
    ${xmlAssinado}
</enviNFe>`;
            
            const request = {
                nfeDadosMsg: loteXml
            };
            
            console.log('⏳ Aguardando resposta da SEFAZ...');
            const result = await method(request);
            
            console.log('✅ Resposta recebida da SEFAZ');
            return result;
            
        } catch (error) {
            throw new Error(`Erro ao enviar para SEFAZ: ${error.message}`);
        }
    }
    
    async emitirNFe(dadosNFe) {
        console.log('🎯 INICIANDO EMISSÃO DE NFe');
        console.log('===========================\n');
        
        try {
            // 1. Gerar XML
            const { xml, chaveAcesso } = this.generateNFeXML(dadosNFe);
            console.log(`🔑 Chave de Acesso: ${chaveAcesso}\n`);
            
            // 2. Assinar XML
            const xmlAssinado = this.signXML(xml);
            
            // 3. Salvar XML (opcional)
            if (process.env.SAVE_XML_FILES === 'true') {
                const xmlDir = process.env.XML_OUTPUT_DIR || './xmls';
                if (!fs.existsSync(xmlDir)) {
                    fs.mkdirSync(xmlDir, { recursive: true });
                }
                
                const xmlPath = path.join(xmlDir, `NFe_${chaveAcesso}.xml`);
                fs.writeFileSync(xmlPath, xmlAssinado, 'utf8');
                console.log(`💾 XML salvo em: ${xmlPath}\n`);
            }
            
            // 4. Enviar para SEFAZ
            const resultado = await this.sendToSefaz(xmlAssinado);
            
            // 5. Processar resposta
            console.log('\n📋 RESULTADO DA EMISSÃO:');
            
            if (resultado && resultado.nfeResultMsg) {
                const xmlResposta = resultado.nfeResultMsg;
                console.log('📄 XML de resposta:');
                console.log(xmlResposta);
                
                // Extrair informações da resposta
                const cStatMatch = xmlResposta.match(/<cStat>(\d+)<\/cStat>/);
                const xMotivoMatch = xmlResposta.match(/<xMotivo>([^<]+)<\/xMotivo>/);
                const protocoloMatch = xmlResposta.match(/<nProt>(\d+)<\/nProt>/);
                
                if (cStatMatch && xMotivoMatch) {
                    const cStat = cStatMatch[1];
                    const xMotivo = xMotivoMatch[1];
                    const protocolo = protocoloMatch ? protocoloMatch[1] : null;
                    
                    console.log(`\n📊 STATUS: ${cStat} - ${xMotivo}`);
                    
                    if (protocolo) {
                        console.log(`📋 PROTOCOLO: ${protocolo}`);
                    }
                    
                    if (cStat === '100') {
                        console.log('🎉 SUCESSO: NFe autorizada!');
                        return {
                            sucesso: true,
                            chaveAcesso,
                            protocolo,
                            status: cStat,
                            motivo: xMotivo,
                            xmlResposta
                        };
                    } else {
                        console.log(`⚠️  NFe rejeitada: ${xMotivo}`);
                        return {
                            sucesso: false,
                            chaveAcesso,
                            status: cStat,
                            motivo: xMotivo,
                            xmlResposta
                        };
                    }
                }
            }
            
            console.log('📄 Resposta completa:');
            console.log(JSON.stringify(resultado, null, 2));
            
            return {
                sucesso: false,
                erro: 'Resposta inesperada da SEFAZ',
                resposta: resultado
            };
            
        } catch (error) {
            console.log(`❌ Erro na emissão: ${error.message}`);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }
}

// Função principal para teste
async function testarEmissaoNFe() {
    console.log('🚀 TESTE DE EMISSÃO DE NFe COMPLETA');
    console.log('===================================\n');
    
    const emitter = new NFeEmitter();
    
    try {
        // Inicializar
        await emitter.initialize();
        
        // Dados de teste
        const dadosNFe = {
            numero: '1',
            serie: '1',
            emitente: {
                nome: 'MAP LTDA',
                endereco: {
                    logradouro: 'Rua Teste Emitente',
                    numero: '123',
                    bairro: 'Centro',
                    cep: '01000000'
                },
                ie: 'ISENTO'
            },
            destinatario: {
                cpf: '12345678901',
                nome: 'Cliente Teste Homologacao',
                endereco: {
                    logradouro: 'Rua Cliente Teste',
                    numero: '456',
                    bairro: 'Bairro Teste',
                    cep: '02000000'
                }
            },
            itens: [{
                descricao: 'Produto Teste Homologacao',
                quantidade: '1.0000',
                valorUnitario: '10.00',
                valorTotal: '10.00'
            }]
        };
        
        // Emitir NFe
        const resultado = await emitter.emitirNFe(dadosNFe);
        
        console.log('\n🎯 RESULTADO FINAL:');
        console.log(JSON.stringify(resultado, null, 2));
        
        if (resultado.sucesso) {
            console.log('\n🎉 NFe emitida com sucesso!');
            console.log('✅ Sistema de emissão funcionando corretamente');
        } else {
            console.log('\n⚠️  NFe não foi autorizada');
            console.log('📋 Verifique os dados e configurações');
        }
        
    } catch (error) {
        console.log(`❌ Erro no teste: ${error.message}`);
    }
    
    console.log('\n✅ Teste de emissão completo!');
}

// Executar teste se chamado diretamente
if (require.main === module) {
    testarEmissaoNFe().catch(console.error);
}

module.exports = NFeEmitter;