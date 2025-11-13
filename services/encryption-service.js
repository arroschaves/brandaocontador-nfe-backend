// ==================== SERVIÇO DE CRIPTOGRAFIA ====================
// Criptografa dados sensíveis (certificados, senhas) usando AES-256-GCM
// IMPORTANTE: Requer ENCRYPTION_KEY configurado nas variáveis de ambiente

const crypto = require("crypto");

class EncryptionService {
  constructor() {
    this.algorithm = "aes-256-gcm";
    this.keyLength = 32; // 256 bits

    // Validar ENCRYPTION_KEY
    this.encryptionKey = process.env.ENCRYPTION_KEY;

    if (!this.encryptionKey) {
      throw new Error(
        "❌ ERRO CRÍTICO: ENCRYPTION_KEY não está configurado! Gere com: openssl rand -hex 32",
      );
    }

    // Converter hex para buffer
    if (this.encryptionKey.length !== 64) {
      throw new Error(
        "❌ ERRO CRÍTICO: ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (32 bytes)",
      );
    }

    this.key = Buffer.from(this.encryptionKey, "hex");
  }

  /**
   * Criptografa dados
   * @param {string|Buffer} data - Dados a criptografar
   * @returns {string} Dados criptografados em formato hex: iv:authTag:encrypted
   */
  encrypt(data) {
    try {
      // Gerar IV aleatório (Initialization Vector)
      const iv = crypto.randomBytes(16);

      // Criar cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Criptografar
      const encrypted = Buffer.concat([
        cipher.update(data, "utf8"),
        cipher.final(),
      ]);

      // Obter auth tag para validação de integridade
      const authTag = cipher.getAuthTag();

      // Retornar iv:authTag:encrypted em hex
      return Buffer.concat([iv, authTag, encrypted]).toString("hex");
    } catch (error) {
      console.error("❌ Erro ao criptografar dados:", error.message);
      throw new Error("Falha na criptografia de dados");
    }
  }

  /**
   * Descriptografa dados
   * @param {string} encryptedData - Dados criptografados em formato hex
   * @returns {string} Dados descriptografados
   */
  decrypt(encryptedData) {
    try {
      // Converter de hex para buffer
      const buffer = Buffer.from(encryptedData, "hex");

      // Extrair componentes
      const iv = buffer.subarray(0, 16);
      const authTag = buffer.subarray(16, 32);
      const encrypted = buffer.subarray(32);

      // Criar decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      // Descriptografar
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString("utf8");
    } catch (error) {
      console.error("❌ Erro ao descriptografar dados:", error.message);
      throw new Error(
        "Falha na descriptografia de dados - chave incorreta ou dados corrompidos",
      );
    }
  }

  /**
   * Criptografa buffer (para arquivos binários como certificados)
   * @param {Buffer} buffer - Buffer a criptografar
   * @returns {string} Buffer criptografado em hex
   */
  encryptBuffer(buffer) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

      const authTag = cipher.getAuthTag();

      return Buffer.concat([iv, authTag, encrypted]).toString("hex");
    } catch (error) {
      console.error("❌ Erro ao criptografar buffer:", error.message);
      throw new Error("Falha na criptografia de buffer");
    }
  }

  /**
   * Descriptografa buffer
   * @param {string} encryptedHex - Buffer criptografado em hex
   * @returns {Buffer} Buffer descriptografado
   */
  decryptBuffer(encryptedHex) {
    try {
      const buffer = Buffer.from(encryptedHex, "hex");

      const iv = buffer.subarray(0, 16);
      const authTag = buffer.subarray(16, 32);
      const encrypted = buffer.subarray(32);

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (error) {
      console.error("❌ Erro ao descriptografar buffer:", error.message);
      throw new Error("Falha na descriptografia de buffer");
    }
  }

  /**
   * Gera hash seguro (para comparação, não para criptografia)
   * @param {string} data - Dados a hashear
   * @returns {string} Hash SHA-256 em hex
   */
  hash(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Gera chave aleatória segura
   * @param {number} length - Tamanho em bytes
   * @returns {string} Chave em hex
   */
  static generateKey(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Gera secret base64 (para JWT, API keys)
   * @param {number} length - Tamanho em bytes
   * @returns {string} Secret em base64
   */
  static generateSecret(length = 32) {
    return crypto.randomBytes(length).toString("base64");
  }
}

module.exports = new EncryptionService();
