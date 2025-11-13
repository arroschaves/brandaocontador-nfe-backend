const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CertificateService = require("../services/certificate-service");
const UserService = require("../services/user-service");

// Configuração do multer para upload de certificados
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".pfx", ".p12"].includes(ext)) {
      return cb(
        new Error("Formato de certificado inválido (use .pfx ou .p12)"),
      );
    }
    cb(null, true);
  },
});

/**
 * @swagger
 * /api/me:
 *   get:
 *     tags:
 *       - Usuário
 *     summary: Obter dados do usuário logado
 *     description: Retorna as informações do usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 dados:
 *                   $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const advancedLogger = req.app.get("advancedLogger");

    // Log da requisição
    advancedLogger.logInfo("auth", "Solicitação de dados do usuário", req, {
      userId: req.user.id,
    });

    // Buscar dados do usuário usando o UserService
    const userResult = await UserService.obterUsuario(req.user.id);

    if (!userResult.success) {
      advancedLogger.logError("auth", "Usuário não encontrado", req, null, {
        userId: req.user.id,
      });

      return res.status(404).json({
        sucesso: false,
        erro: "Usuário não encontrado",
        codigo: "USER_NOT_FOUND",
      });
    }

    const dadosUsuario = userResult.data;

    // Verificar se tem certificado digital
    const certificateService = new CertificateService();
    const certificadoResult = await certificateService.obterCertificado(
      req.user.id,
    );
    const certificadoInfo = certificadoResult.success
      ? certificadoResult.data
      : null;

    const dadosCompletos = {
      ...dadosUsuario,
      certificado: certificadoInfo
        ? {
            valido: certificadoInfo.dadosCertificado?.valido || true,
            dataVencimento: certificadoInfo.dadosCertificado?.dataVencimento,
            titular: certificadoInfo.dadosCertificado?.titular,
            cnpj: certificadoInfo.dadosCertificado?.cnpj,
          }
        : null,
    };

    advancedLogger.logInfo(
      "auth",
      "Dados do usuário retornados com sucesso",
      req,
      {
        userId: req.user.id,
        temCertificado: !!certificadoInfo,
      },
    );

    res.json({
      sucesso: true,
      dados: dadosCompletos,
    });
  } catch (error) {
    const advancedLogger = req.app.get("advancedLogger");
    advancedLogger.logError(
      "auth",
      "Erro ao obter dados do usuário",
      req,
      error,
      {
        userId: req.user?.id,
      },
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro interno do servidor",
      codigo: "INTERNAL_ERROR",
    });
  }
});

/**
 * @swagger
 * /api/me:
 *   patch:
 *     tags:
 *       - Usuário
 *     summary: Atualizar dados do usuário logado
 *     description: Atualiza as informações do usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: "João Silva Santos"
 *               telefone:
 *                 type: string
 *                 example: "(11) 99999-9999"
 *               endereco:
 *                 type: object
 *                 properties:
 *                   logradouro:
 *                     type: string
 *                   numero:
 *                     type: string
 *                   complemento:
 *                     type: string
 *                   bairro:
 *                     type: string
 *                   cidade:
 *                     type: string
 *                   uf:
 *                     type: string
 *                   cep:
 *                     type: string
 *     responses:
 *       200:
 *         description: Dados atualizados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 dados:
 *                   $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch("/", authMiddleware.verificarAutenticacao(), async (req, res) => {
  try {
    const advancedLogger = req.app.get("advancedLogger");
    const { nome, telefone, endereco } = req.body;

    // Log da requisição
    advancedLogger.logInfo(
      "auth",
      "Solicitação de atualização de dados do usuário",
      req,
      {
        userId: req.user.id,
        camposAtualizados: Object.keys(req.body),
      },
    );

    // Validações básicas
    if (nome && (typeof nome !== "string" || nome.trim().length < 2)) {
      return res.status(400).json({
        sucesso: false,
        erro: "Nome deve ter pelo menos 2 caracteres",
        codigo: "INVALID_NAME",
      });
    }

    if (
      telefone &&
      (typeof telefone !== "string" || telefone.trim().length < 10)
    ) {
      return res.status(400).json({
        sucesso: false,
        erro: "Telefone deve ter pelo menos 10 caracteres",
        codigo: "INVALID_PHONE",
      });
    }

    // Preparar dados para atualização
    const dadosAtualizados = {};

    if (nome !== undefined) {
      dadosAtualizados.nome = nome.trim();
    }

    if (telefone !== undefined) {
      dadosAtualizados.telefone = telefone.trim();
    }

    if (endereco !== undefined) {
      dadosAtualizados.endereco = endereco;
    }

    // Atualizar usuário usando UserService
    const updateResult = await UserService.atualizarUsuario(
      req.user.id,
      dadosAtualizados,
    );

    if (!updateResult.success) {
      advancedLogger.logError("auth", "Erro ao atualizar usuário", req, null, {
        userId: req.user.id,
        erro: updateResult.message,
      });

      return res.status(404).json({
        sucesso: false,
        erro: updateResult.message || "Usuário não encontrado",
        codigo: "USER_UPDATE_ERROR",
      });
    }

    const dadosUsuario = updateResult.data;

    advancedLogger.logInfo(
      "auth",
      "Dados do usuário atualizados com sucesso",
      req,
      {
        userId: req.user.id,
        dadosAtualizados,
      },
    );

    res.json({
      sucesso: true,
      dados: dadosUsuario,
      mensagem: "Dados atualizados com sucesso",
    });
  } catch (error) {
    const advancedLogger = req.app.get("advancedLogger");
    advancedLogger.logError(
      "auth",
      "Erro ao atualizar dados do usuário",
      req,
      error,
      {
        userId: req.user?.id,
      },
    );

    res.status(500).json({
      sucesso: false,
      erro: "Erro interno do servidor",
      codigo: "INTERNAL_ERROR",
    });
  }
});

/**
 * @swagger
 * /api/me/certificado:
 *   post:
 *     tags:
 *       - Usuário
 *     summary: Upload de certificado digital
 *     description: Faz upload e instala o certificado digital do usuário
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               certificado:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo do certificado (.pfx ou .p12)
 *               senha:
 *                 type: string
 *                 description: Senha do certificado
 *             required:
 *               - certificado
 *               - senha
 *     responses:
 *       200:
 *         description: Certificado instalado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 dados:
 *                   type: object
 *                   properties:
 *                     titular:
 *                       type: string
 *                     cnpj:
 *                       type: string
 *                     dataVencimento:
 *                       type: string
 *                       format: date
 *                     valido:
 *                       type: boolean
 *       400:
 *         description: Arquivo ou senha inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/certificado",
  authMiddleware.verificarAutenticacao(),
  upload.single("certificado"),
  async (req, res) => {
    try {
      const advancedLogger = req.app.get("advancedLogger");
      const { senha } = req.body;

      // Log da requisição
      advancedLogger.logInfo(
        "certificados",
        "Solicitação de upload de certificado",
        req,
        {
          userId: req.user.id,
          nomeArquivo: req.file?.originalname,
        },
      );

      if (!req.file) {
        return res.status(400).json({
          sucesso: false,
          erro: "Arquivo de certificado é obrigatório",
          codigo: "MISSING_CERTIFICATE_FILE",
        });
      }

      if (!senha) {
        return res.status(400).json({
          sucesso: false,
          erro: "Senha do certificado é obrigatória",
          codigo: "MISSING_CERTIFICATE_PASSWORD",
        });
      }

      // Processar certificado
      const certificateService = new CertificateService();

      try {
        const resultado = await certificateService.installCertificate(
          req.user.id,
          req.file.buffer,
          senha,
          req.file.originalname,
        );

        advancedLogger.logInfo(
          "certificados",
          "Certificado instalado com sucesso",
          req,
          {
            userId: req.user.id,
            titular: resultado.titular,
            cnpj: resultado.cnpj,
            dataVencimento: resultado.dataVencimento,
          },
        );

        res.json({
          sucesso: true,
          dados: resultado,
          mensagem: "Certificado instalado com sucesso",
        });
      } catch (certError) {
        advancedLogger.logError(
          "certificados",
          "Erro ao processar certificado",
          req,
          certError,
          {
            userId: req.user.id,
            nomeArquivo: req.file.originalname,
          },
        );

        if (certError.message.includes("senha")) {
          return res.status(400).json({
            sucesso: false,
            erro: "Senha do certificado incorreta",
            codigo: "INVALID_CERTIFICATE_PASSWORD",
          });
        }

        if (certError.message.includes("formato")) {
          return res.status(400).json({
            sucesso: false,
            erro: "Formato de certificado inválido",
            codigo: "INVALID_CERTIFICATE_FORMAT",
          });
        }

        return res.status(400).json({
          sucesso: false,
          erro: "Erro ao processar certificado: " + certError.message,
          codigo: "CERTIFICATE_PROCESSING_ERROR",
        });
      }
    } catch (error) {
      const advancedLogger = req.app.get("advancedLogger");
      advancedLogger.logError(
        "certificados",
        "Erro interno no upload de certificado",
        req,
        error,
        {
          userId: req.user?.id,
        },
      );

      res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor",
        codigo: "INTERNAL_ERROR",
      });
    }
  },
);

module.exports = router;
