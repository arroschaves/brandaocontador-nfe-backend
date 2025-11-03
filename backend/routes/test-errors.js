const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /api/test-error:
 *   post:
 *     tags:
 *       - Testes
 *     summary: Testar sistema de logging de erros
 *     description: Endpoint para testar diferentes tipos de erro e verificar se estão sendo logados corretamente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [500, 404, validation, database, frontend, uncaught]
 *                 description: Tipo de erro para testar
 *               message:
 *                 type: string
 *                 description: Mensagem personalizada do erro
 *     responses:
 *       500:
 *         description: Erro interno do servidor (proposital)
 *       400:
 *         description: Erro de validação (proposital)
 *       404:
 *         description: Erro 404 (proposital)
 */
router.post('/test-error', (req, res, next) => {
  const { tipo, message } = req.body;
  const advancedLogger = req.app.get('advancedLogger');

  try {
    switch (tipo) {
      case '500':
        const error500 = new Error(message || 'Erro 500 de teste');
        error500.statusCode = 500;
        error500.code = 'TEST_ERROR_500';
        throw error500;

      case '404':
        const error404 = new Error(message || 'Recurso não encontrado');
        error404.statusCode = 404;
        error404.code = 'TEST_ERROR_404';
        throw error404;

      case 'validation':
        const validationError = new Error(message || 'Erro de validação de teste');
        validationError.name = 'ValidationError';
        validationError.details = {
          campo1: 'Campo obrigatório',
          campo2: 'Formato inválido'
        };
        advancedLogger.logValidationError(validationError.message, req, validationError.details);
        return res.status(400).json({
          sucesso: false,
          erro: 'Erro de validação de teste',
          codigo: 'VALIDATION_ERROR',
          detalhes: validationError.details
        });

      case 'database':
        const dbError = new Error(message || 'Erro de banco de dados de teste');
        dbError.name = 'DatabaseError';
        dbError.code = 'ECONNREFUSED';
        dbError.errno = -4078;
        advancedLogger.logDatabaseError(dbError.message, req, dbError);
        return res.status(500).json({
          sucesso: false,
          erro: 'Erro de banco de dados de teste',
          codigo: 'DATABASE_ERROR'
        });

      case 'frontend':
        const frontendErrorData = {
          message: message || 'Erro do frontend de teste',
          stack: 'Error: Erro do frontend\n    at Component.render (app.js:123:45)',
          url: 'http://localhost:3000/dashboard',
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        };
        advancedLogger.logFrontendError(frontendErrorData, req);
        return res.status(200).json({
          sucesso: true,
          message: 'Erro de frontend logado com sucesso'
        });

      case 'uncaught':
        // Simular uma exceção não tratada (cuidado!)
        setTimeout(() => {
          throw new Error(message || 'Exceção não tratada de teste');
        }, 100);
        return res.status(200).json({
          sucesso: true,
          message: 'Exceção não tratada será disparada em 100ms'
        });

      default:
        return res.status(400).json({
          sucesso: false,
          erro: 'Tipo de erro inválido',
          codigo: 'INVALID_ERROR_TYPE',
          tiposValidos: ['500', '404', 'validation', 'database', 'frontend', 'uncaught']
        });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/test-404:
 *   get:
 *     tags:
 *       - Testes
 *     summary: Testar erro 404
 *     description: Endpoint que sempre retorna 404 para testar o sistema de logging
 *     responses:
 *       404:
 *         description: Não encontrado (proposital)
 */
router.get('/test-404', (req, res) => {
  const advancedLogger = req.app.get('advancedLogger');
  
  advancedLogger.logWarning('system', 'Teste de 404 executado', req, {
    type: 'test404',
    proposital: true
  });

  res.status(404).json({
    sucesso: false,
    erro: 'Endpoint de teste 404',
    codigo: 'TEST_404',
    message: 'Este é um erro 404 proposital para testar o sistema de logging'
  });
});

/**
 * @swagger
 * /api/test-logs/status:
 *   get:
 *     tags:
 *       - Testes
 *     summary: Verificar status do sistema de logs
 *     description: Verifica se os arquivos de log estão sendo criados corretamente
 *     responses:
 *       200:
 *         description: Status dos logs
 */
router.get('/test-logs/status', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const advancedLogger = req.app.get('advancedLogger');
  
  try {
    const logsDir = path.join(__dirname, '..', 'logs');
    const status = {
      logsDirectory: logsDir,
      exists: fs.existsSync(logsDir),
      categories: [],
      totalFiles: 0
    };

    if (status.exists) {
      const categories = ['auth', 'nfe', 'clientes', 'certificados', 'dashboard', 'produtos', 'system'];
      
      categories.forEach(category => {
        const categoryDir = path.join(logsDir, category);
        const categoryStatus = {
          name: category,
          exists: fs.existsSync(categoryDir),
          types: []
        };

        if (categoryStatus.exists) {
          const types = ['errors', 'warnings', 'info', 'frontend', 'database', 'validation'];
          
          types.forEach(type => {
            const typeDir = path.join(categoryDir, type);
            const typeStatus = {
              name: type,
              exists: fs.existsSync(typeDir),
              files: []
            };

            if (typeStatus.exists) {
              try {
                const files = fs.readdirSync(typeDir);
                typeStatus.files = files.map(file => ({
                  name: file,
                  size: fs.statSync(path.join(typeDir, file)).size,
                  modified: fs.statSync(path.join(typeDir, file)).mtime
                }));
                status.totalFiles += files.length;
              } catch (err) {
                typeStatus.error = err.message;
              }
            }

            categoryStatus.types.push(typeStatus);
          });
        }

        status.categories.push(categoryStatus);
      });
    }

    advancedLogger.logInfo('system', 'Status dos logs verificado', req, {
      totalFiles: status.totalFiles,
      dirExists: status.exists
    });

    res.json({
      sucesso: true,
      status
    });

  } catch (error) {
    advancedLogger.logError('system', 'Erro ao verificar status dos logs', req, error);
    
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao verificar status dos logs',
      codigo: 'LOG_STATUS_ERROR'
    });
  }
});

module.exports = router;