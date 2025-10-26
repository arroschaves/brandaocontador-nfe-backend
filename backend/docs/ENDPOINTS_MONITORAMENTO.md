# 📊 DOCUMENTAÇÃO - ENDPOINTS DE MONITORAMENTO

## 🎯 Visão Geral

Este documento descreve todos os endpoints de monitoramento, métricas e observabilidade implementados no backend NFe consolidado.

## 🌐 Endpoints Disponíveis

### 1. **Health Check Básico**
```
GET /health
```

**Descrição**: Endpoint público para verificação básica de saúde do sistema.

**Autenticação**: Não requerida

**Resposta de Exemplo**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-25T02:29:10.667Z",
  "uptime": 95.7522296,
  "environment": "development",
  "version": "1.0.0",
  "checks": {
    "memory": {
      "status": "healthy",
      "usage": {
        "heapUsed": "35MB",
        "heapTotal": "37MB",
        "percentage": "94%"
      },
      "threshold": "90%"
    },
    "cpu": {
      "status": "healthy",
      "usage": "1%",
      "threshold": "80%"
    },
    "eventLoop": {
      "status": "healthy",
      "lag": "0ms",
      "threshold": "100ms"
    }
  },
  "responseTime": "354ms"
}
```

**Status Possíveis**:
- `healthy`: Sistema funcionando normalmente
- `warning`: Alguns componentes com problemas menores
- `critical`: Problemas críticos detectados

---

### 2. **Health Check Detalhado**
```
GET /health/detailed
```

**Descrição**: Endpoint autenticado para verificação detalhada de saúde do sistema.

**Autenticação**: Bearer Token requerido

**Headers Necessários**:
```
Authorization: Bearer <token>
```

**Resposta de Exemplo**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-25T02:29:10.667Z",
  "uptime": 95.7522296,
  "environment": "development",
  "version": "1.0.0",
  "system": {
    "memory": {
      "heapUsed": 36700160,
      "heapTotal": 38797312,
      "external": 2345678,
      "rss": 89123456
    },
    "cpu": {
      "usage": 1.2,
      "loadAverage": [0.1, 0.2, 0.3]
    },
    "eventLoop": {
      "lag": 0.5,
      "utilization": 0.02
    }
  },
  "database": {
    "status": "connected",
    "type": "json",
    "connections": 1
  },
  "certificates": {
    "status": "warning",
    "loaded": false,
    "expiryDays": 0
  },
  "sefaz": {
    "status": "simulated",
    "connectivity": true,
    "lastCheck": "2025-10-25T02:29:10.667Z"
  }
}
```

---

### 3. **Métricas Prometheus**
```
GET /metrics
```

**Descrição**: Endpoint público para coleta de métricas no formato Prometheus.

**Autenticação**: Não requerida

**Content-Type**: `text/plain; version=0.0.4; charset=utf-8`

**Métricas Disponíveis**:

#### **Métricas Padrão do Node.js**:
- `process_cpu_user_seconds_total`
- `process_cpu_system_seconds_total`
- `process_start_time_seconds`
- `process_resident_memory_bytes`
- `nodejs_heap_size_total_bytes`
- `nodejs_heap_size_used_bytes`
- `nodejs_external_memory_bytes`
- `nodejs_heap_space_size_total_bytes`
- `nodejs_heap_space_size_used_bytes`
- `nodejs_version_info`

#### **Métricas Customizadas NFe**:
- `nfe_backend_nfe_requests_total` - Contador de requisições NFe
- `nfe_backend_nfe_requests_duration_seconds` - Duração das requisições
- `nfe_backend_nfe_errors_total` - Contador de erros NFe
- `nfe_backend_sefaz_response_time_seconds` - Tempo de resposta SEFAZ
- `nfe_backend_certificate_expiry_days` - Dias até expiração do certificado
- `nfe_backend_database_connections` - Conexões do banco de dados
- `nfe_backend_memory_usage_bytes` - Uso de memória
- `nfe_backend_cpu_usage_percent` - Uso de CPU
- `nfe_backend_event_loop_lag_seconds` - Event loop lag
- `nfe_backend_system_status` - Status geral do sistema

**Exemplo de Saída**:
```
# HELP nfe_backend_process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE nfe_backend_process_cpu_user_seconds_total counter
nfe_backend_process_cpu_user_seconds_total 1.813

# HELP nfe_backend_nfe_requests_total Contador total de requisições NFe
# TYPE nfe_backend_nfe_requests_total counter
nfe_backend_nfe_requests_total{method="GET",endpoint="/health",status_code="200",operation="unknown"} 1

# HELP nfe_backend_memory_usage_bytes Uso de memória em bytes
# TYPE nfe_backend_memory_usage_bytes gauge
nfe_backend_memory_usage_bytes{type="rss"} 89123456
nfe_backend_memory_usage_bytes{type="heapUsed"} 36700160
```

---

### 4. **Status de Performance**
```
GET /status/performance
```

**Descrição**: Endpoint autenticado para métricas detalhadas de performance.

**Autenticação**: Bearer Token requerido

**Headers Necessários**:
```
Authorization: Bearer <token>
```

**Resposta de Exemplo**:
```json
{
  "timestamp": "2025-10-25T02:29:10.667Z",
  "uptime": 95.7522296,
  "performance": {
    "cpu": {
      "usage": 1.2,
      "loadAverage": [0.1, 0.2, 0.3]
    },
    "memory": {
      "heapUsed": 36700160,
      "heapTotal": 38797312,
      "external": 2345678,
      "rss": 89123456,
      "percentage": 94.6
    },
    "eventLoop": {
      "lag": 0.5,
      "utilization": 0.02
    },
    "gc": {
      "collections": 45,
      "duration": 123.45
    }
  },
  "requests": {
    "total": 156,
    "avgResponseTime": 245.6,
    "requestsPerSecond": 1.63
  },
  "errors": {
    "total": 2,
    "rate": 1.28
  }
}
```

---

### 5. **Alertas Administrativos**
```
GET /admin/alerts
```

**Descrição**: Endpoint para visualização de alertas do sistema.

**Autenticação**: Bearer Token + Permissão Admin

**Headers Necessários**:
```
Authorization: Bearer <token>
```

**Resposta de Exemplo**:
```json
{
  "alerts": [
    {
      "id": "high_memory_usage",
      "name": "Alto uso de memória",
      "status": "active",
      "severity": "warning",
      "threshold": 90,
      "currentValue": 94.6,
      "triggeredAt": "2025-10-25T02:25:10.667Z",
      "description": "Uso de memória acima do limite"
    }
  ],
  "summary": {
    "total": 9,
    "active": 1,
    "resolved": 8
  },
  "rules": [
    {
      "name": "high_memory_usage",
      "enabled": true,
      "threshold": 90,
      "severity": "warning"
    }
  ]
}
```

---

### 6. **Teste de Alertas**
```
POST /admin/alerts/test
```

**Descrição**: Endpoint para testar o sistema de alertas.

**Autenticação**: Bearer Token + Permissão Admin

**Headers Necessários**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body de Exemplo**:
```json
{
  "alertType": "high_memory_usage",
  "testValue": 95.0
}
```

**Resposta de Exemplo**:
```json
{
  "success": true,
  "message": "Alerta de teste enviado com sucesso",
  "alert": {
    "type": "high_memory_usage",
    "triggered": true,
    "value": 95.0,
    "threshold": 90,
    "timestamp": "2025-10-25T02:29:10.667Z"
  }
}
```

---

## 🔐 Autenticação

### **Endpoints Públicos**:
- `GET /health`
- `GET /metrics`

### **Endpoints Autenticados**:
- `GET /health/detailed`
- `GET /status/performance`

### **Endpoints Administrativos**:
- `GET /admin/alerts`
- `POST /admin/alerts/test`

### **Como Obter Token**:
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@brandaocontador.com.br",
    "senha": "admin123"
  }'
```

---

## 📊 Integração com Ferramentas

### **Prometheus**
Configure o Prometheus para fazer scraping do endpoint `/metrics`:

```yaml
scrape_configs:
  - job_name: 'nfe-backend'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### **Grafana**
Importe as métricas do Prometheus para criar dashboards customizados.

### **Alertmanager**
Configure alertas baseados nas métricas coletadas.

---

## 🚨 Códigos de Status

### **Health Check Status**:
- `healthy` (200): Sistema funcionando normalmente
- `warning` (200): Alguns componentes com problemas menores
- `critical` (503): Problemas críticos detectados

### **Códigos de Erro**:
- `401`: Token de acesso não fornecido ou inválido
- `403`: Permissões insuficientes
- `500`: Erro interno do servidor

---

## 📈 Métricas de Negócio

### **Operações NFe Monitoradas**:
- Emissão de NFe
- Consulta de NFe
- Cancelamento de NFe
- Inutilização de numeração
- Validação de XML

### **Métricas SEFAZ**:
- Tempo de resposta por UF
- Taxa de sucesso/erro
- Conectividade em tempo real

### **Certificados Digitais**:
- Status de carregamento
- Dias até expiração
- Alertas automáticos

---

## 🔧 Configuração

As configurações de monitoramento estão em:
- `config/monitoring.js` - Configurações gerais
- Variáveis de ambiente para thresholds
- Logs em `logs/` directory

---

## 📝 Logs

Todos os endpoints geram logs estruturados com:
- Trace IDs para correlação
- Timestamps precisos
- Níveis de log apropriados
- Formato JSON para análise

---

*Documentação atualizada em: 25/10/2025*