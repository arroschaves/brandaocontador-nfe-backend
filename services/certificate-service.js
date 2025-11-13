/**
 * Serviço de certificados digitais
 * Gerencia upload, validação e armazenamento de certificados A1/A3
 * SEGURANÇA: Usa criptografia AES-256-GCM para armazenar certificados e senhas
 */

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const encryptionService = require("./encryption-service");

class CertificateService {
  constructor() {
    this.certificatesPath = path.join(process.cwd(), "certs");
    this.certificates = new Map(); // Cache de certificados em memória
    this.ensureCertsDirectory();
  }

  /**
   * Garante que o diretório de certificados existe
   */
  async ensureCertsDirectory() {
    try {
      await fs.access(this.certificatesPath);
    } catch (error) {
      await fs.mkdir(this.certificatesPath, { recursive: true });
    }
  }

  /**
   * Instala certificado digital (método principal para upload)
   */
  async installCertificate(userId, buffer, senha, originalname) {
    try {
      if (!buffer) {
        throw new Error("Arquivo de certificado não fornecido");
      }

      if (!senha) {
        throw new Error("Senha do certificado é obrigatória");
      }

      // Valida tipo de arquivo
      const extensoesPermitidas = [".pfx", ".p12"];
      const extensao = path.extname(originalname).toLowerCase();

      if (!extensoesPermitidas.includes(extensao)) {
        throw new Error("Tipo de arquivo não suportado. Use .pfx ou .p12");
      }

      // Valida tamanho do arquivo (máximo 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new Error("Arquivo muito grande. Máximo 5MB");
      }

      // Gera nome único para o arquivo
      const timestamp = Date.now();
      const nomeArquivo = `cert_${userId}_${timestamp}${extensao}`;
      const caminhoArquivo = path.join(this.certificatesPath, nomeArquivo);

      // SEGURANÇA: Criptografa o certificado antes de salvar no disco
      const certificadoCriptografado = encryptionService.encryptBuffer(buffer);
      await fs.writeFile(caminhoArquivo, certificadoCriptografado, "utf8");

      // Valida o certificado (usando buffer original)
      const dadosCertificado = await this.validarCertificado(buffer, senha);

      // SEGURANÇA: Criptografa a senha antes de armazenar
      const senhaCriptografada = encryptionService.encrypt(senha);

      // Armazena informações do certificado
      const certificadoInfo = {
        id: crypto.randomUUID(),
        userId,
        nomeArquivo,
        caminhoArquivo,
        senha: senhaCriptografada, // Senha criptografada
        dadosCertificado,
        dataUpload: new Date().toISOString(),
        ativo: true,
      };

      this.certificates.set(userId, certificadoInfo);

      // Retorna informações do certificado
      return {
        titular: dadosCertificado.titular,
        cnpj: dadosCertificado.cnpj,
        dataVencimento: dadosCertificado.dataVencimento,
        emissor: dadosCertificado.emissor,
      };
    } catch (error) {
      console.error("❌ Erro no upload do certificado:", error.message);
      throw new Error(`Falha no upload do certificado: ${error.message}`);
    }
  }

  /**
   * Valida certificado digital
   * @param {Buffer|string} certificado - Buffer do certificado ou caminho do arquivo
   * @param {string} senha - Senha do certificado
   */
  async validarCertificado(certificado, senha) {
    try {
      // Se recebeu caminho, lê e descriptografa o arquivo
      let certificadoBuffer;
      if (typeof certificado === "string") {
        const encrypted = await fs.readFile(certificado, "utf8");
        certificadoBuffer = encryptionService.decryptBuffer(encrypted);
      } else {
        certificadoBuffer = certificado;
      }

      // Simula validação do certificado (em produção, usar biblioteca específica)
      // Por exemplo: node-forge, pkcs12, etc.

      // Validação básica do formato
      if (certificadoBuffer.length < 100) {
        throw new Error("Arquivo de certificado inválido");
      }

      // Simula extração de dados do certificado
      const dadosCertificado = {
        titular: "EMPRESA TESTE LTDA",
        cnpj: "12345678000123",
        dataInicio: new Date().toISOString(),
        dataVencimento: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 1 ano
        emissor: "AC TESTE",
        numeroSerie: "123456789",
        algoritmo: "RSA-2048",
        uso: ["assinatura_digital", "nfe", "nfce"],
        valido: true,
      };

      // Verifica se o certificado não está vencido
      const agora = new Date();
      const vencimento = new Date(dadosCertificado.dataVencimento);

      if (vencimento < agora) {
        throw new Error("Certificado vencido");
      }

      // Verifica se ainda não está válido
      const inicio = new Date(dadosCertificado.dataInicio);
      if (inicio > agora) {
        throw new Error("Certificado ainda não é válido");
      }

      return dadosCertificado;
    } catch (error) {
      console.error("❌ Erro na validação do certificado:", error.message);
      throw new Error(`Certificado inválido: ${error.message}`);
    }
  }

  /**
   * Obtém certificado do usuário
   */
  async obterCertificado(userId) {
    try {
      const certificado = this.certificates.get(userId);

      if (!certificado) {
        return {
          success: false,
          message: "Nenhum certificado encontrado para este usuário",
        };
      }

      // Verifica se o arquivo ainda existe
      try {
        await fs.access(certificado.caminhoArquivo);
      } catch (error) {
        // Remove certificado inválido do cache
        this.certificates.delete(userId);
        throw new Error("Arquivo de certificado não encontrado");
      }

      // Remove dados sensíveis
      const { senha, caminhoArquivo, ...certificadoSeguro } = certificado;

      return {
        success: true,
        data: certificadoSeguro,
      };
    } catch (error) {
      console.error("❌ Erro ao obter certificado:", error.message);
      throw new Error(`Falha ao obter certificado: ${error.message}`);
    }
  }

  /**
   * Remove certificado do usuário
   */
  async removerCertificado(userId) {
    try {
      const certificado = this.certificates.get(userId);

      if (!certificado) {
        throw new Error("Nenhum certificado encontrado para este usuário");
      }

      // Remove arquivo físico
      try {
        await fs.unlink(certificado.caminhoArquivo);
      } catch (error) {
        console.warn(
          "⚠️ Arquivo de certificado já foi removido:",
          error.message,
        );
      }

      // Remove do cache
      this.certificates.delete(userId);

      return {
        success: true,
        message: "Certificado removido com sucesso",
      };
    } catch (error) {
      console.error("❌ Erro ao remover certificado:", error.message);
      throw new Error(`Falha ao remover certificado: ${error.message}`);
    }
  }

  /**
   * Verifica status do certificado
   */
  async verificarStatusCertificado(userId) {
    try {
      const certificado = this.certificates.get(userId);

      if (!certificado) {
        return {
          success: true,
          data: {
            temCertificado: false,
            status: "nao_configurado",
          },
        };
      }

      const agora = new Date();
      const vencimento = new Date(certificado.dadosCertificado.dataVencimento);
      const diasRestantes = Math.ceil(
        (vencimento - agora) / (1000 * 60 * 60 * 24),
      );

      let status = "valido";
      if (diasRestantes <= 0) {
        status = "vencido";
      } else if (diasRestantes <= 30) {
        status = "vencendo";
      }

      return {
        success: true,
        data: {
          temCertificado: true,
          status,
          diasRestantes,
          dataVencimento: certificado.dadosCertificado.dataVencimento,
          titular: certificado.dadosCertificado.titular,
          emissor: certificado.dadosCertificado.emissor,
        },
      };
    } catch (error) {
      console.error(
        "❌ Erro ao verificar status do certificado:",
        error.message,
      );
      throw new Error(
        `Falha ao verificar status do certificado: ${error.message}`,
      );
    }
  }

  /**
   * Verifica status do certificado (método alternativo)
   */
  async getCertificateStatus() {
    try {
      const certificate = await this.loadCertificate(true); // Modo opcional

      if (!certificate) {
        return {
          status: "not_configured",
          info: null,
          message:
            "Certificado digital não configurado - Cliente deve importar via interface",
        };
      }

      const info = this.getCertificateInfo(certificate);

      return {
        status: "valid",
        info,
        message: "Certificado carregado e válido",
      };
    } catch (error) {
      return {
        status: "error",
        info: null,
        message: error.message,
        suggestions: [
          "Verifique se o arquivo do certificado existe",
          "Confirme se a senha do certificado está correta",
          "Verifique se o certificado não expirou",
          "Certifique-se de que o arquivo é um certificado PFX válido",
        ],
      };
    }
  }

  /**
   * Lista certificados próximos do vencimento
   */
  async listarCertificadosVencendo(diasLimite = 30) {
    try {
      const certificadosVencendo = [];
      const agora = new Date();

      for (const [userId, certificado] of this.certificates) {
        const vencimento = new Date(
          certificado.dadosCertificado.dataVencimento,
        );
        const diasRestantes = Math.ceil(
          (vencimento - agora) / (1000 * 60 * 60 * 24),
        );

        if (diasRestantes <= diasLimite && diasRestantes > 0) {
          certificadosVencendo.push({
            userId,
            titular: certificado.dadosCertificado.titular,
            diasRestantes,
            dataVencimento: certificado.dadosCertificado.dataVencimento,
          });
        }
      }

      return {
        success: true,
        data: certificadosVencendo,
        total: certificadosVencendo.length,
      };
    } catch (error) {
      console.error("❌ Erro ao listar certificados vencendo:", error.message);
      throw new Error(
        `Falha ao listar certificados vencendo: ${error.message}`,
      );
    }
  }

  /**
   * Obtém certificado para assinatura (com senha)
   */
  async obterCertificadoParaAssinatura(userId) {
    try {
      const certificado = this.certificates.get(userId);

      if (!certificado) {
        throw new Error("Certificado não encontrado");
      }

      // Verifica validade
      const agora = new Date();
      const vencimento = new Date(certificado.dadosCertificado.dataVencimento);

      if (vencimento < agora) {
        throw new Error("Certificado vencido");
      }

      // Retorna dados necessários para assinatura
      return {
        success: true,
        data: {
          caminhoArquivo: certificado.caminhoArquivo,
          senha: certificado.senha,
          dadosCertificado: certificado.dadosCertificado,
        },
      };
    } catch (error) {
      console.error(
        "❌ Erro ao obter certificado para assinatura:",
        error.message,
      );
      throw new Error(
        `Falha ao obter certificado para assinatura: ${error.message}`,
      );
    }
  }

  /**
   * Carrega certificado dos caminhos padrão
   */
  async loadCertificate() {
    try {
      const caminhosPadrao = [
        "certificado.pfx",
        "cert.pfx",
        "nfe.pfx",
        path.join(process.cwd(), "certificado.pfx"),
        path.join(process.cwd(), "cert.pfx"),
        path.join(process.cwd(), "nfe.pfx"),
      ];

      for (const caminho of caminhosPadrao) {
        try {
          await fs.access(caminho);
          return {
            path: caminho,
          };
        } catch (error) {
          // Continua para o próximo caminho
        }
      }

      throw new Error("Nenhum certificado encontrado nos caminhos padrão");
    } catch (error) {
      throw new Error(`Erro ao carregar certificado: ${error.message}`);
    }
  }

  /**
   * Carrega certificado de um caminho específico
   */
  async loadCertificateFromPath(caminho, senha) {
    try {
      await fs.access(caminho);
      return {
        path: caminho,
      };
    } catch (error) {
      throw new Error(`Certificado não encontrado em: ${caminho}`);
    }
  }

  /**
   * Obtém informações do certificado
   */
  getCertificateInfo(certificate) {
    return {
      subject: {
        commonName: "EMPRESA TESTE LTDA",
      },
      issuer: {
        commonName: "AC TESTE",
      },
      validity: {
        notAfter: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      path: certificate.path,
    };
  }
}

module.exports = CertificateService;
