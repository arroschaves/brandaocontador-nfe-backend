/**
 * URLs dos WebServices SEFAZ NFe 4.0 - Produção e Homologação
 * Atualizado conforme legislação vigente 2024/2025
 * Ambiente: 1=Produção, 2=Homologação
 */

const WEBSERVICES_NFE_4_0 = {
    // Acre
    'AC': {
        autorizacao: {
            '1': 'https://nfe.sefaz.ac.gov.br/ws/NFeAutorizacao4',
            '2': 'https://hom.nfe.sefaz.ac.gov.br/ws/NFeAutorizacao4'
        },
        retAutorizacao: {
            '1': 'https://nfe.sefaz.ac.gov.br/ws/NFeRetAutorizacao4',
            '2': 'https://hom.nfe.sefaz.ac.gov.br/ws/NFeRetAutorizacao4'
        },
        consultaProtocolo: {
            '1': 'https://nfe.sefaz.ac.gov.br/ws/NFeConsultaProtocolo4',
            '2': 'https://hom.nfe.sefaz.ac.gov.br/ws/NFeConsultaProtocolo4'
        },
        statusServico: {
            '1': 'https://nfe.sefaz.ac.gov.br/ws/NFeStatusServico4',
            '2': 'https://hom.nfe.sefaz.ac.gov.br/ws/NFeStatusServico4'
        },
        recepcaoEvento: {
            '1': 'https://nfe.sefaz.ac.gov.br/ws/NFeRecepcaoEvento4',
            '2': 'https://hom.nfe.sefaz.ac.gov.br/ws/NFeRecepcaoEvento4'
        },
        inutilizacao: {
            '1': 'https://nfe.sefaz.ac.gov.br/ws/NFeInutilizacao4',
            '2': 'https://hom.nfe.sefaz.ac.gov.br/ws/NFeInutilizacao4'
        },
        consultaCadastro: {
            '1': 'https://nfe.sefaz.ac.gov.br/ws/CadConsultaCadastro4',
            '2': 'https://hom.nfe.sefaz.ac.gov.br/ws/CadConsultaCadastro4'
        }
    },

    // Mato Grosso do Sul - URLs oficiais conforme SEFAZ/MS
    'MS': {
        autorizacao: {
            '1': 'https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4',
            '2': 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4'
        },
        retAutorizacao: {
            '1': 'https://nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4',
            '2': 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4'
        },
        consultaProtocolo: {
            '1': 'https://nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4',
            '2': 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4'
        },
        statusServico: {
            '1': 'https://nfe.sefaz.ms.gov.br/ws/NFeStatusServico4',
            '2': 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeStatusServico4'
        },
        recepcaoEvento: {
            '1': 'https://nfe.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4',
            '2': 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4'
        },
        inutilizacao: {
            '1': 'https://nfe.sefaz.ms.gov.br/ws/NFeInutilizacao4',
            '2': 'https://hom.nfe.sefaz.ms.gov.br/ws/NFeInutilizacao4'
        },
        consultaCadastro: {
            '1': 'https://nfe.sefaz.ms.gov.br/ws/CadConsultaCadastro4',
            '2': 'https://hom.nfe.sefaz.ms.gov.br/ws/CadConsultaCadastro4'
        }
    },

    // Pernambuco - URLs oficiais conforme SEFAZ/PE
    'PE': {
        autorizacao: {
            '1': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4',
            '2': 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4'
        },
        retAutorizacao: {
            '1': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4',
            '2': 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4'
        },
        consultaProtocolo: {
            '1': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
            '2': 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4'
        },
        statusServico: {
            '1': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4',
            '2': 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4'
        },
        recepcaoEvento: {
            '1': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4',
            '2': 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4'
        },
        inutilizacao: {
            '1': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeInutilizacao4',
            '2': 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeInutilizacao4'
        },
        consultaCadastro: {
            '1': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/CadConsultaCadastro4',
            '2': 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/CadConsultaCadastro4'
        }
    },

    // São Paulo
    'SP': {
        autorizacao: {
            '1': 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
            '2': 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx'
        },
        retAutorizacao: {
            '1': 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
            '2': 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx'
        },
        consultaProtocolo: {
            '1': 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
            '2': 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx'
        },
        statusServico: {
            '1': 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
            '2': 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx'
        },
        recepcaoEvento: {
            '1': 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
            '2': 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx'
        },
        inutilizacao: {
            '1': 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
            '2': 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx'
        },
        consultaCadastro: {
            '1': 'https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx',
            '2': 'https://homologacao.nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx'
        }
    },

    // SVRS - Sistema Virtual da Receita Estadual (para estados que usam o sistema compartilhado)
    'SVRS': {
        autorizacao: {
            '1': 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
            '2': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx'
        },
        retAutorizacao: {
            '1': 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
            '2': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx'
        },
        consultaProtocolo: {
            '1': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
            '2': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx'
        },
        statusServico: {
            '1': 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
            '2': 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx'
        },
        recepcaoEvento: {
            '1': 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
            '2': 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
        },
        inutilizacao: {
            '1': 'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
            '2': 'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx'
        },
        consultaCadastro: {
            '1': 'https://nfe.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
            '2': 'https://nfe-homologacao.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx'
        }
    }
};

/**
 * Função para obter URL do webservice por UF, ambiente e serviço
 * @param {string} uf - Sigla da UF
 * @param {string} ambiente - '1' para produção, '2' para homologação
 * @param {string} servico - Tipo de serviço (autorizacao, retAutorizacao, etc.)
 * @returns {string} URL do webservice
 */
function getWebServiceUrl(uf, ambiente, servico = 'autorizacao') {
    // Estados que usam SVRS
    const estadosSVRS = ['AL', 'AP', 'DF', 'ES', 'PB', 'RJ', 'RN', 'RO', 'RR', 'SC', 'SE', 'TO'];
    
    if (estadosSVRS.includes(uf)) {
        return WEBSERVICES_NFE_4_0.SVRS[servico]?.[ambiente];
    }
    
    return WEBSERVICES_NFE_4_0[uf]?.[servico]?.[ambiente];
}

/**
 * Função para verificar se a UF está online (status do serviço)
 * @param {string} uf - Sigla da UF
 * @param {string} ambiente - '1' para produção, '2' para homologação
 * @returns {string} URL do serviço de status
 */
function getStatusServiceUrl(uf, ambiente) {
    return getWebServiceUrl(uf, ambiente, 'statusServico');
}

module.exports = {
    WEBSERVICES_NFE_4_0,
    getWebServiceUrl,
    getStatusServiceUrl,
    
    // Compatibilidade com versão anterior
    ...Object.keys(WEBSERVICES_NFE_4_0).reduce((acc, uf) => {
        acc[uf] = {
            '1': WEBSERVICES_NFE_4_0[uf].autorizacao?.['1'],
            '2': WEBSERVICES_NFE_4_0[uf].autorizacao?.['2']
        };
        return acc;
    }, {})
};
