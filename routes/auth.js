const express = require("express");
const router = express.Router();

// Importar middleware de autenticação
const authMiddleware = require("../middleware/auth");

// Registrar novo usuário
router.post("/register", authMiddleware.register);

// Fazer login
router.post("/login", authMiddleware.login);

// Validar token
router.get("/validate", authMiddleware.validarToken);

module.exports = router;
