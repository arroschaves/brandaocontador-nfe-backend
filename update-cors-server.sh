#!/bin/bash

# Script para atualizar configuração CORS no servidor

# Atualizar a seção CORS no app.js
cat > /tmp/cors_fix.js << 'EOF'
// CORS configurado para permitir requisições do frontend
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['https://brandaocontador.com.br', 'https://app.brandaocontador.com.br', 'https://nfe.brandaocontador.com.br', 'http://localhost:3000', 'http://localhost:3002'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
EOF

# Fazer backup do app.js atual
cp /var/www/brandaocontador-nfe-backend/app.js /var/www/brandaocontador-nfe-backend/app.js.backup

# Substituir a configuração CORS no app.js
sed -i '/\/\/ CORS configurado para permitir requisições do frontend/,/}));/c\
// CORS configurado para permitir requisições do frontend\
const corsOrigins = process.env.CORS_ORIGINS \
  ? process.env.CORS_ORIGINS.split('"'"','"'"').map(origin => origin.trim())\
  : ['"'"'https://brandaocontador.com.br'"'"', '"'"'https://app.brandaocontador.com.br'"'"', '"'"'https://nfe.brandaocontador.com.br'"'"', '"'"'http://localhost:3000'"'"', '"'"'http://localhost:3002'"'"'];\
\
app.use(cors({\
  origin: corsOrigins,\
  credentials: true,\
  methods: ['"'"'GET'"'"', '"'"'POST'"'"', '"'"'PUT'"'"', '"'"'DELETE'"'"', '"'"'OPTIONS'"'"'],\
  allowedHeaders: ['"'"'Content-Type'"'"', '"'"'Authorization'"'"', '"'"'X-API-Key'"'"']\
}));' /var/www/brandaocontador-nfe-backend/app.js

echo "CORS configuration updated successfully!"