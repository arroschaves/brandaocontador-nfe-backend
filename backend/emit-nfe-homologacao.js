require('dotenv').config();
const fs = require('fs');
const path = require('path');
const soap = require('soap');
const forge = require('node-forge');
const crypto = require('crypto');
const { DOMParser, XMLSerializer } = require('xmldom');
const xpath = require('xpath');

// Configurações
const config = {
    uf: process.env.UF || 'SP',
    ambiente: parseInt(process.env.AMBIENTE) || 2, // 1=Produção, 2=Homologação
    cnpj: process.env.CNPJ_EMITENTE,
    certificadoPath: process.env.CERT_PATH,
    certificadoSenha: process.env.CERT_PASS,
    timeout: parseInt(process.env.TIMEOUT) || 30000
};

// URLs dos serviços SEFAZ
const urlsServicos = {
    SP: {
        homologacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx?wsdl',
        producao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx?wsdl'
    },
    SVRS: {
        homologacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx?wsdl',
        producao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx?wsdl'
    }
};

class EmissorNFe {
    constructor() {
        this.certificado = null;
        this.chavePrivada = null;
        this.soapClient = null;
    }

    async inicializar() {
        console.log('🚀 Inicializando Emissor de NFe para Homologação');
        console.log('=' .repeat(50));
        
        this.exibirConfiguracoes();
        await this.carregarCertificado();
        await this.criarClienteSOAP();
    }

    exibirConfiguracoes() {
        console.log('\n📋 CONFIGURAÇÕES:');
        console.log(`UF: ${config.uf}`);
        console.log(`Ambiente: ${config.ambiente === 1 ? 'Produção' : 'Homologação'}`);
        console.log(`CNPJ: ${config.cnpj}`);
        console.log(`Certificado: ${config.certificadoPath}`);
    }

    async carregarCertificado() {
        console.log('\n🔐 Carregando certificado...');
        
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
            console.log(`📅 Válido até: ${this.certificado.validity.notAfter}`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar certificado:', error.message);
            throw error;
        }
    }

    async criarClienteSOAP() {
        console.log('\n🔗 Criando cliente SOAP...');
        
        const ambiente = config.ambiente === 1 ? 'producao' : 'homologacao';
        const url = urlsServicos[config.uf][ambiente];
        console.log(`URL: ${url}`);
        
        try {
            // Converter certificado para PEM
            const certPem = forge.pki.certificateToPem(this.certificado);
            const keyPem = forge.pki.privateKeyToPem(this.chavePrivada);
            
            // Para homologação, desabilitar verificação SSL temporariamente
            if (config.ambiente === 2) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
                console.log('🔐 Configurando certificado para homologação...');
            }
            
            // Configurações básicas do cliente SOAP
            const options = {
                timeout: config.timeout,
                forceSoap12Headers: false
            };
            
            this.soapClient = await soap.createClientAsync(url, options);
            
            // Configurar segurança SSL com certificado
            this.soapClient.setSecurity(new soap.ClientSSLSecurity(keyPem, certPem));
            
            console.log('✅ Cliente SOAP criado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao criar cliente SOAP:', error.message);
            throw error;
        }
    }

    gerarChaveAcesso() {
        const agora = new Date();
        const ano = agora.getFullYear().toString().substr(-2);
        const mes = (agora.getMonth() + 1).toString().padStart(2, '0');
        const cnpj = config.cnpj.replace(/\D/g, '');
        const modelo = '55'; // NFe
        const serie = '001';
        const numero = Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
        const tipoEmissao = '1'; // Normal
        const codigoNumerico = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
        
        const chave = `${config.uf === 'SP' ? '35' : '43'}${ano}${mes}${cnpj}${modelo}${serie}${numero}${tipoEmissao}${codigoNumerico}`;
        
        // Calcular dígito verificador
        const dv = this.calcularDV(chave);
        
        return chave + dv;
    }

    calcularDV(chave) {
        const sequencia = '4329876543298765432987654329876543298765432';
        let soma = 0;
        
        for (let i = 0; i < chave.length; i++) {
            soma += parseInt(chave[i]) * parseInt(sequencia[i]);
        }
        
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }

    gerarXMLNFe(dadosNFe) {
        const chaveAcesso = this.gerarChaveAcesso();
        const agora = new Date();
        const dataEmissao = agora.toISOString().split('T')[0];
        const horaEmissao = agora.toTimeString().split(' ')[0];
        
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chaveAcesso}">
    <ide>
      <cUF>${config.uf === 'SP' ? '35' : '43'}</cUF>
      <cNF>${chaveAcesso.substr(-9, 8)}</cNF>
      <natOp>Venda de mercadoria</natOp>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>${parseInt(chaveAcesso.substr(-17, 9))}</nNF>
      <dhEmi>${dataEmissao}T${horaEmissao}-03:00</dhEmi>
      <tpNF>1</tpNF>
      <idDest>2</idDest>
      <cMunFG>3550308</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chaveAcesso.substr(-1)}</cDV>
      <tpAmb>${config.ambiente}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
    </ide>
    <emit>
      <CNPJ>${config.cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>MAP LTDA</xNome>
      <enderEmit>
        <xLgr>RUA TESTE</xLgr>
        <nro>123</nro>
        <xBairro>CENTRO</xBairro>
        <cMun>3550308</cMun>
        <xMun>SAO PAULO</xMun>
        <UF>SP</UF>
        <CEP>01000000</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderEmit>
      <IE>123456789</IE>
      <CRT>3</CRT>
    </emit>
    <dest>
      <CPF>12345678901</CPF>
      <xNome>CLIENTE TESTE</xNome>
      <enderDest>
        <xLgr>RUA DO CLIENTE</xLgr>
        <nro>456</nro>
        <xBairro>BAIRRO TESTE</xBairro>
        <cMun>3550308</cMun>
        <xMun>SAO PAULO</xMun>
        <UF>SP</UF>
        <CEP>02000000</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderDest>
      <indIEDest>9</indIEDest>
    </dest>
    <det nItem="1">
      <prod>
        <cProd>001</cProd>
        <cEAN></cEAN>
        <xProd>PRODUTO TESTE</xProd>
        <NCM>12345678</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>1.0000</qCom>
        <vUnCom>100.0000</vUnCom>
        <vProd>100.00</vProd>
        <cEANTrib></cEANTrib>
        <uTrib>UN</uTrib>
        <qTrib>1.0000</qTrib>
        <vUnTrib>100.0000</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>100.00</vBC>
            <pICMS>18.00</pICMS>
            <vICMS>18.00</vICMS>
          </ICMS00>
        </ICMS>
        <PIS>
          <PISAliq>
            <CST>01</CST>
            <vBC>100.00</vBC>
            <pPIS>1.65</pPIS>
            <vPIS>1.65</vPIS>
          </PISAliq>
        </PIS>
        <COFINS>
          <COFINSAliq>
            <CST>01</CST>
            <vBC>100.00</vBC>
            <pCOFINS>7.60</pCOFINS>
            <vCOFINS>7.60</vCOFINS>
          </COFINSAliq>
        </COFINS>
      </imposto>
    </det>
    <total>
      <ICMSTot>
        <vBC>100.00</vBC>
        <vICMS>18.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>100.00</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>1.65</vPIS>
        <vCOFINS>7.60</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>100.00</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>100.00</vPag>
      </detPag>
    </pag>
  </infNFe>
</NFe>`;
        
        return { xml, chaveAcesso };
    }

    assinarXML(xml) {
        console.log('\n🔏 Assinando XML...');
        
        try {
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const infNFe = xpath.select('//infNFe', doc)[0];
            
            if (!infNFe) {
                throw new Error('Elemento infNFe não encontrado');
            }
            
            // Canonicalizar o elemento infNFe
            const xmlCanonical = new XMLSerializer().serializeToString(infNFe);
            
            // Calcular hash SHA1
            const hash = crypto.createHash('sha1').update(xmlCanonical, 'utf8').digest();
            
            // Assinar com a chave privada
            const signature = this.chavePrivada.sign(hash);
            const signatureBase64 = forge.util.encode64(signature);
            
            // Criar elemento de assinatura
            const signatureXML = `
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1" />
      <Reference URI="#${infNFe.getAttribute('Id')}">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
          <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" />
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1" />
        <DigestValue>${forge.util.encode64(hash)}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${signatureBase64}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(this.certificado)).getBytes())}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`;
            
            // Inserir assinatura no XML
            const xmlAssinado = xml.replace('</NFe>', signatureXML + '\n</NFe>');
            
            console.log('✅ XML assinado com sucesso');
            return xmlAssinado;
            
        } catch (error) {
            console.error('❌ Erro ao assinar XML:', error.message);
            throw error;
        }
    }

    async enviarNFe(xmlAssinado, chaveAcesso) {
        console.log('\n📤 Enviando NFe para SEFAZ...');
        
        try {
            const loteXML = `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <idLote>1</idLote>
  <indSinc>1</indSinc>
  ${xmlAssinado}
</enviNFe>`;
            
            const args = {
                nfeCabecMsg: {
                    cUF: config.uf === 'SP' ? '35' : '43',
                    versaoDados: '4.00'
                },
                nfeDadosMsg: loteXML
            };
            
            console.log('🔄 Chamando serviço NFeAutorizacao4...');
            const result = await this.soapClient.NFeAutorizacao4Async(args);
            
            console.log('📥 Resposta recebida:');
            console.log(JSON.stringify(result, null, 2));
            
            return this.processarResposta(result, chaveAcesso);
            
        } catch (error) {
            console.error('❌ Erro ao enviar NFe:', error.message);
            throw error;
        }
    }

    processarResposta(result, chaveAcesso) {
        console.log('\n🔍 Processando resposta da SEFAZ...');
        
        try {
            const response = result[0];
            const retorno = response.NFeAutorizacao4Result || response;
            
            console.log('📋 Status da resposta:');
            console.log(`Chave de Acesso: ${chaveAcesso}`);
            
            if (retorno.cStat) {
                console.log(`Código: ${retorno.cStat}`);
                console.log(`Motivo: ${retorno.xMotivo}`);
                
                if (retorno.cStat === '103' || retorno.cStat === '104') {
                    console.log('✅ NFe processada com sucesso!');
                    if (retorno.protNFe) {
                        console.log(`Protocolo: ${retorno.protNFe.infProt.nProt}`);
                    }
                } else {
                    console.log('⚠️  NFe processada com ressalvas ou erro');
                }
            }
            
            return {
                sucesso: true,
                chaveAcesso,
                resposta: retorno
            };
            
        } catch (error) {
            console.error('❌ Erro ao processar resposta:', error.message);
            return {
                sucesso: false,
                erro: error.message,
                chaveAcesso
            };
        }
    }

    async emitirNFe(dadosNFe = {}) {
        console.log('\n🎯 INICIANDO EMISSÃO DE NFe');
        console.log('=' .repeat(40));
        
        try {
            // Gerar XML da NFe
            const { xml, chaveAcesso } = this.gerarXMLNFe(dadosNFe);
            console.log(`\n📄 XML gerado para chave: ${chaveAcesso}`);
            
            // Assinar XML
            const xmlAssinado = this.assinarXML(xml);
            
            // Salvar XML para debug
            const nomeArquivo = `nfe_${chaveAcesso}.xml`;
            fs.writeFileSync(nomeArquivo, xmlAssinado);
            console.log(`💾 XML salvo como: ${nomeArquivo}`);
            
            // Enviar para SEFAZ
            const resultado = await this.enviarNFe(xmlAssinado, chaveAcesso);
            
            console.log('\n🎉 EMISSÃO CONCLUÍDA!');
            return resultado;
            
        } catch (error) {
            console.error('\n💥 ERRO NA EMISSÃO:', error.message);
            throw error;
        }
    }
}

// Função de teste
async function testarEmissaoNFe() {
    console.log('🚀 TESTE DE EMISSÃO DE NFe EM HOMOLOGAÇÃO');
    console.log('=' .repeat(50));
    
    try {
        const emissor = new EmissorNFe();
        await emissor.inicializar();
        
        const dadosNFe = {
            destinatario: {
                cpf: '12345678901',
                nome: 'CLIENTE TESTE HOMOLOGACAO',
                endereco: {
                    logradouro: 'RUA TESTE HOMOLOGACAO',
                    numero: '123',
                    bairro: 'CENTRO',
                    municipio: 'SAO PAULO',
                    uf: 'SP',
                    cep: '01000000'
                }
            },
            produtos: [{
                codigo: '001',
                descricao: 'PRODUTO TESTE HOMOLOGACAO',
                quantidade: 1,
                valorUnitario: 100.00,
                valorTotal: 100.00
            }]
        };
        
        const resultado = await emissor.emitirNFe(dadosNFe);
        
        console.log('\n📊 RESULTADO FINAL:');
        console.log(JSON.stringify(resultado, null, 2));
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    } finally {
        // Restaurar verificação SSL
        if (config.ambiente === 2) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
        }
    }
}

// Executar teste se chamado diretamente
if (require.main === module) {
    testarEmissaoNFe().then(() => {
        console.log('\n✅ Teste de emissão completo!');
    }).catch(error => {
        console.error('\n💥 Falha no teste:', error.message);
        process.exit(1);
    });
}

module.exports = { EmissorNFe, testarEmissaoNFe };