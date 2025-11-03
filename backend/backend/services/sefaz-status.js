/**
 * Serviço de Status da SEFAZ - Verificação Real de Conectividade
 * Sistema de monitoramento em tempo real dos webservices SEFAZ
 */

const https = require('https');
const soap = require('soap');
const { getWebServiceUrl, getStatusServiceUrl } = require('../ws_urls_uf');

class SefazStatusService {
    constructor() {
        this.statusCache = new Map();
        this.cacheTimeout = 60000; // 1 minuto
        this.requestTimeout = 10000; // 10 segundos
        this.retryAttempts = 3;
        this.retryDelay = 2000; // 2 segundos
    }

    /**
     * Verifica status de uma UF específica
     * @param {string} uf - Sigla da UF
     * @param {string} ambiente - '1' para produção, '2' para homologação
     * @returns {Promise<Object>} Status da SEFAZ
     */
    async verificarStatusUF(uf, ambiente = '1') {
        const cacheKey = `${uf}_${ambiente}`;
        
        // Verificar cache
        if (this.statusCache.has(cacheKey)) {
            const cached = this.statusCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const status = await this._verificarStatusComRetry(uf, ambiente);
            
            // Atualizar cache
            this.statusCache.set(cacheKey, {
                data: status,
                timestamp: Date.now()
            });

            return status;
        } catch (error) {
            console.error(`❌ Erro ao verificar status SEFAZ ${uf}:`, error.message);
            return {
                uf,
                ambiente,
                status: 'offline',
                disponivel: false,
                erro: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Verifica status com retry automático
     * @private
     */
    async _verificarStatusComRetry(uf, ambiente) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                return await this._verificarStatusDireto(uf, ambiente);
            } catch (error) {
                lastError = error;
                
                if (attempt < this.retryAttempts) {
                    console.warn(`⚠️ Tentativa ${attempt} falhou para ${uf}, tentando novamente em ${this.retryDelay}ms...`);
                    await this._delay(this.retryDelay);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Verificação direta do status
     * @private
     */
    async _verificarStatusDireto(uf, ambiente) {
        const startTime = Date.now();
        
        // Primeiro: verificar conectividade básica
        const conectividade = await this._verificarConectividade(uf, ambiente);
        
        if (!conectividade.disponivel) {
            return {
                uf,
                ambiente,
                status: 'offline',
                disponivel: false,
                conectividade,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
        }

        // Segundo: verificar serviço de status específico
        const statusServico = await this._verificarStatusServico(uf, ambiente);
        
        return {
            uf,
            ambiente,
            status: statusServico.disponivel ? 'online' : 'offline',
            disponivel: statusServico.disponivel,
            conectividade,
            statusServico,
            responseTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Verifica conectividade básica com o servidor SEFAZ
     * @private
     */
    async _verificarConectividade(uf, ambiente) {
        return new Promise((resolve) => {
            const url = getWebServiceUrl(uf, ambiente, 'autorizacao');
            
            if (!url) {
                resolve({
                    disponivel: false,
                    erro: 'URL do webservice não encontrada',
                    url: null
                });
                return;
            }

            const urlObj = new URL(url);
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: '/',
                method: 'HEAD',
                timeout: this.requestTimeout,
                rejectUnauthorized: false // Para certificados auto-assinados
            };

            const req = https.request(options, (res) => {
                resolve({
                    disponivel: true,
                    statusCode: res.statusCode,
                    url: url,
                    servidor: urlObj.hostname
                });
            });

            req.on('error', (error) => {
                resolve({
                    disponivel: false,
                    erro: error.message,
                    url: url,
                    servidor: urlObj.hostname
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    disponivel: false,
                    erro: 'Timeout na conexão',
                    url: url,
                    servidor: urlObj.hostname
                });
            });

            req.end();
        });
    }

    /**
     * Verifica o serviço de status específico da SEFAZ
     * @private
     */
    async _verificarStatusServico(uf, ambiente) {
        try {
            const statusUrl = getStatusServiceUrl(uf, ambiente);
            
            if (!statusUrl) {
                return {
                    disponivel: false,
                    erro: 'URL do serviço de status não encontrada'
                };
            }

            // Criar cliente SOAP para verificar WSDL
            const client = await soap.createClientAsync(statusUrl, {
                timeout: this.requestTimeout,
                disableCache: true
            });

            // Se chegou até aqui, o WSDL está acessível
            const operations = Object.keys(client).filter(key => 
                typeof client[key] === 'function' && 
                key.toLowerCase().includes('status')
            );

            return {
                disponivel: true,
                url: statusUrl,
                operations: operations,
                wsdlAcessivel: true
            };

        } catch (error) {
            return {
                disponivel: false,
                erro: error.message,
                url: getStatusServiceUrl(uf, ambiente)
            };
        }
    }

    /**
     * Verifica status de múltiplas UFs
     * @param {Array<string>} ufs - Array de UFs para verificar
     * @param {string} ambiente - Ambiente (1=produção, 2=homologação)
     * @returns {Promise<Object>} Status consolidado
     */
    async verificarStatusMultiplasUFs(ufs, ambiente = '1') {
        const resultados = await Promise.allSettled(
            ufs.map(uf => this.verificarStatusUF(uf, ambiente))
        );

        const status = {};
        let totalOnline = 0;
        let totalOffline = 0;

        resultados.forEach((resultado, index) => {
            const uf = ufs[index];
            
            if (resultado.status === 'fulfilled') {
                status[uf] = resultado.value;
                if (resultado.value.disponivel) {
                    totalOnline++;
                } else {
                    totalOffline++;
                }
            } else {
                status[uf] = {
                    uf,
                    ambiente,
                    status: 'erro',
                    disponivel: false,
                    erro: resultado.reason.message,
                    timestamp: new Date().toISOString()
                };
                totalOffline++;
            }
        });

        return {
            ambiente,
            resumo: {
                total: ufs.length,
                online: totalOnline,
                offline: totalOffline,
                percentualDisponibilidade: Math.round((totalOnline / ufs.length) * 100)
            },
            detalhes: status,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Verifica status geral do sistema SEFAZ
     * @param {string} ambiente - Ambiente (1=produção, 2=homologação)
     * @returns {Promise<Object>} Status geral
     */
    async verificarStatusGeral(ambiente = '1') {
        const ufsImportantes = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'MS', 'PE'];
        const svrsEstados = ['AL', 'AP', 'DF', 'ES', 'PB', 'RN', 'RO', 'RR', 'SE', 'TO'];
        
        // Verificar UFs importantes + SVRS
        const todasUFs = [...ufsImportantes, 'SVRS'];
        
        const statusGeral = await this.verificarStatusMultiplasUFs(todasUFs, ambiente);
        
        // Adicionar informações sobre SVRS
        if (statusGeral.detalhes.SVRS) {
            statusGeral.detalhes.SVRS.estadosAtendidos = svrsEstados;
        }

        return {
            ...statusGeral,
            sistemaGeral: {
                status: statusGeral.resumo.percentualDisponibilidade >= 80 ? 'online' : 'instavel',
                disponibilidade: statusGeral.resumo.percentualDisponibilidade,
                ambiente: ambiente === '1' ? 'produção' : 'homologação'
            }
        };
    }

    /**
     * Limpa o cache de status
     */
    limparCache() {
        this.statusCache.clear();
        console.log('🧹 Cache de status SEFAZ limpo');
    }

    /**
     * Obtém estatísticas do cache
     */
    getEstatisticasCache() {
        return {
            entradas: this.statusCache.size,
            timeout: this.cacheTimeout,
            ultimaLimpeza: new Date().toISOString()
        };
    }

    /**
     * Delay helper
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = SefazStatusService;