#!/bin/bash
# Script de start da aplicação

cd /opt/nfe-backend
pm2 start ecosystem.config.js
echo "✅ Aplicação iniciada"
