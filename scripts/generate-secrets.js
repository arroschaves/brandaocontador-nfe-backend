#!/usr/bin/env node

/**
 * Script para gerar secrets seguros para o sistema NFe
 * Uso: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║    GERADOR DE SECRETS SEGUROS - Sistema NFe Brandão           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('Copie e cole os valores abaixo no seu arquivo .env:\n');
console.log('─'.repeat(66));

// JWT_SECRET (base64, 32 bytes)
const jwtSecret = crypto.randomBytes(32).toString('base64');
console.log('\n# JWT Secret (para assinatura de tokens)');
console.log(`JWT_SECRET=${jwtSecret}`);

// ENCRYPTION_KEY (hex, 32 bytes)
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('\n# Encryption Key (para criptografia de certificados e senhas)');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);

// API_KEYS (gera 3 keys)
const apiKey1 = crypto.randomBytes(32).toString('base64');
const apiKey2 = crypto.randomBytes(32).toString('base64');
const apiKey3 = crypto.randomBytes(32).toString('base64');
console.log('\n# API Keys (para integração com sistemas externos)');
console.log(`API_KEYS=${apiKey1},${apiKey2},${apiKey3}`);

console.log('\n' + '─'.repeat(66));
console.log('\n⚠️  IMPORTANTE:');
console.log('  • Guarde estes secrets em local seguro');
console.log('  • NUNCA commite o arquivo .env no git');
console.log('  • Em produção, use secrets management (Vault, AWS Secrets, etc.)');
console.log('  • Regenere os secrets se houver suspeita de comprometimento\n');

console.log('✅ Comandos úteis:\n');
console.log('  # Gerar apenas JWT_SECRET:');
console.log('  openssl rand -base64 32\n');
console.log('  # Gerar apenas ENCRYPTION_KEY:');
console.log('  openssl rand -hex 32\n');
console.log('  # Gerar API Key:');
console.log('  openssl rand -base64 32\n');
