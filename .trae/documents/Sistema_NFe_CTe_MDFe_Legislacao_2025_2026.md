# Sistema NFe/CTe/MDFe Completo - Legislação 2025/2026

## 1. LEGISLAÇÃO VIGENTE 2025

### 1.1 NFe 4.0 - Campos Obrigatórios e Validações

#### Campos Essenciais NFe 4.0:
- **Comunicação**: TLS 1.2 ou superior obrigatório
- **GTIN**: Obrigatório indicar GTIN correto ou "SEM GTIN"
- **Grupo de Rastreabilidade**: Obrigatório para medicamentos, bebidas, cigarros
- **Informações de Pagamento**: Novos campos vTroco, detalhamento formas pagamento
- **FCP**: Campos obrigatórios em operações com ST interestadual
- **QR Code 2.0**: Novo padrão para NFC-e

#### Validações Automáticas SEFAZ:
- Rejeição automática para informações inconsistentes
- Validação de valores totais vs parciais
- Verificação de CNPJ/CPF destinatário
- Validação de endereços e CEP

### 1.2 Regras de Emissão por Modelo Fiscal

#### NFC-e (Modelo 65):
- **EXCLUSIVAMENTE** para CPF (consumidor final pessoa física)
- **A partir de 3 de novembro de 2025**: NFC-e NÃO pode mais ser emitida para CNPJ
- Endereço destinatário facultativo em operações presenciais
- DANFE simplificado para vendas diretas
- Contingência offline permitida

#### NFe (Modelo 55):
- **OBRIGATÓRIA** para operações com CNPJ
- Operações interestaduais (inclusive para pessoa física)
- Adaptada para varejo com campos facultativos
- Endereço destinatário facultativo quando operação presencial

### 1.3 CTe e MDFe - Regras Atuais

#### CTe (Conhecimento de Transporte Eletrônico):
- **Prazo Cancelamento**: 168 horas (7 dias)
- **Exceção**: Se vinculado a MDFe, prazo reduz para 24 horas
- **Impossibilidades de Cancelamento**:
  - MDFe já encerrado
  - Registro de passagem fiscal
  - CCe já emitida
  - CTe de substituição emitido

#### MDFe (Manifesto Eletrônico de Documentos Fiscais):
- **Prazo Cancelamento**: 24 horas (unânime em todos os estados)
- **Regra**: Deve ser cancelado ANTES do CTe vinculado
- **Encerramento**: Após encerramento, não permite cancelamento

### 1.4 Processos de Correção e Estorno

#### Carta de Correção Eletrônica (CCe):
**Permite corrigir**:
- Endereços
- Informações complementares
- Observações internas
- Descrições de produtos (sem alterar valor)

**NÃO permite corrigir**:
- Valores, quantidades, preços
- CFOP
- Tomador do serviço
- Alíquotas tributárias
- Data de emissão
- Dados do remetente/destinatário

#### Cancelamento:
**NFe**: 24 horas (maioria dos estados)
- **Exceções**: MT (8h), PI (1140h), PR/RS (168h), RO (720h)

**CTe**: 168 horas
- **Exceção**: MT (8h)

**MDFe**: 24 horas (todos os estados)

#### Estorno de NFe:
**Quando usar**:
- Prazo de cancelamento expirado
- Mercadoria não circulou
- Prestação de serviço não ocorreu

**Procedimento**:
1. Emitir NF-e de entrada (operação inversa)
2. CFOP inverso (ex: 5102 → 1202)
3. Natureza: "999 - Estorno de NF-e não cancelada no prazo legal"
4. Finalidade: "4 - Devolução/Retorno"
5. Referenciar chave da NFe original
6. Justificativa no campo observações

#### Devolução:
**Contribuinte ICMS** (Ajuste SINIEF 13/24):
- Destinatário emite NF-e devolução simbólica
- Natureza: "Anulação de operação - Ajuste SINIEF 13/24"
- Prazo: 168 horas da entrega

**Não Contribuinte**:
- Remetente emite NF-e entrada devolução simbólica
- Mesmo procedimento, mas pelo próprio emitente

### 1.5 Nota Fiscal Referenciada

#### Casos de Uso:
- Devolução de mercadorias
- Complemento de valores
- Anulação de operações
- Substituição de documentos

#### Campos Obrigatórios:
- Chave de acesso da NFe referenciada
- Justificativa da referência
- Tipo de documento referenciado

## 2. REFORMA TRIBUTÁRIA 2026

### 2.1 Novos Tributos (Lei Complementar 214/2025)

#### IBS - Imposto sobre Bens e Serviços:
- **Substitui**: ICMS (estadual) + ISS (municipal)
- **Competência**: Estados e Municípios (Comitê Gestor)
- **Alíquota Estimada**: 14% a 16%
- **Modelo**: Não cumulativo, crédito financeiro pleno
- **Destino**: Local do consumo

#### CBS - Contribuição sobre Bens e Serviços:
- **Substitui**: PIS + COFINS
- **Competência**: Federal (Receita Federal)
- **Alíquota Estimada**: 9% a 12%
- **Modelo**: Não cumulativo, crédito financeiro integral
- **Vigência**: A partir de 2027

#### IS - Imposto Seletivo:
- **Natureza**: Tributo adicional regulatório
- **Incidência**: Produtos prejudiciais à saúde/meio ambiente
- **Produtos**: Cigarros, bebidas alcoólicas, veículos poluentes, apostas
- **Competência**: Federal
- **Vigência**: A partir de 2027

### 2.2 Cronograma de Implementação

#### 2025:
- **Julho**: Início testes ambiente homologação
- **Outubro**: Liberação emissão em produção (facultativo)
- **Novembro**: NFC-e apenas para CPF, NFe obrigatória para CNPJ

#### 2026:
- **Janeiro**: Uso obrigatório novos campos (IBS 0,1%, CBS 0,9%)
- **Dispensa**: Quem cumprir obrigações acessórias não paga
- **Compensação**: Valores recolhidos compensam com PIS/COFINS

#### 2027:
- **Extinção**: PIS e COFINS
- **Vigência**: CBS efetiva + Imposto Seletivo
- **IPI**: Alíquota zero (exceto Zona Franca Manaus)

#### 2029-2033:
- **Redução gradual**: ICMS e ISS (-10% ao ano)
- **Aumento gradual**: IBS
- **2033**: Sistema completamente implementado

### 2.3 Nota Técnica 2025.002 - Novos Campos XML

#### Grupos Adicionados:
- **IBS**: Campos para alíquota, base cálculo, valor
- **CBS**: Campos para alíquota, base cálculo, valor
- **IS**: Campos para produtos seletivos
- **Compras Governamentais**: Tipo compra, percentual redução
- **Classificação Tributária**: CST e cClassTrib

#### Validações Automáticas:
- Consistência entre valores totais e parciais
- Validação de alíquotas por região
- Verificação de códigos de classificação tributária
- Rejeição automática para inconsistências

## 3. FUNCIONALIDADES OBRIGATÓRIAS DO SISTEMA

### 3.1 Emissão de Documentos

#### NFe:
- Emissão normal
- Emissão em contingência
- NFe complementar
- NFe de devolução
- NFe de estorno
- NFe referenciada

#### CTe:
- CTe normal
- CTe de substituição
- CTe complementar
- CTe de anulação

#### MDFe:
- Emissão normal
- Encerramento
- Inclusão de condutor
- Inclusão de DFe

### 3.2 Eventos e Correções

#### Cancelamento:
- Validação de prazos por estado
- Verificação de vínculos (MDFe/CTe)
- Cancelamento extemporâneo (via SEFAZ)

#### Carta de Correção:
- Validação de campos permitidos
- Histórico de correções
- Limite de correções por documento

#### Inutilização:
- Numeração não utilizada
- Justificativa obrigatória
- Consulta de inutilizações

### 3.3 Consultas e Manifestações

#### Consulta Status:
- Status do documento na SEFAZ
- Consulta por chave de acesso
- Consulta por CNPJ

#### Manifestação Destinatário:
- Confirmação da operação
- Desconhecimento da operação
- Operação não realizada
- Ciência da emissão

## 4. CÁLCULOS TRIBUTÁRIOS POR REGIME

### 4.1 Simples Nacional

#### Características:
- Alíquotas progressivas por faturamento
- Sem direito a crédito de ICMS/IPI
- Cálculo único mensal
- Partilha entre tributos federais, estaduais e municipais

#### Cálculo NFe:
```
Valor Simples = (Receita Bruta × Alíquota Anexo) × % ICMS
Base ICMS = Valor Produtos
ICMS = Base ICMS × % ICMS do Simples
```

### 4.2 Lucro Presumido

#### ICMS:
- Base: Valor da operação
- Alíquota: Conforme estado (7%, 12%, 17%, 18%)
- Crédito: Permitido nas aquisições

#### PIS/COFINS:
- PIS: 0,65% sobre faturamento
- COFINS: 3% sobre faturamento
- Regime cumulativo

### 4.3 Lucro Real

#### ICMS:
- Mesmo cálculo Lucro Presumido
- Controle rigoroso de créditos

#### PIS/COFINS:
- PIS: 1,65% sobre receita líquida
- COFINS: 7,6% sobre receita líquida
- Regime não cumulativo (com créditos)

### 4.4 Substituição Tributária

#### ICMS-ST:
```
Base ST = (Valor Produto + IPI + Frete + Seguro + Outras Despesas) × (1 + MVA)
ICMS ST = (Base ST × Alíquota) - ICMS Próprio
```

### 4.5 Cálculos 2026 (IBS/CBS)

#### IBS:
```
Base IBS = Valor da Operação
IBS = Base IBS × Alíquota IBS
Crédito IBS = IBS das Aquisições (integral)
IBS a Recolher = IBS Vendas - Crédito IBS
```

#### CBS:
```
Base CBS = Valor da Operação  
CBS = Base CBS × Alíquota CBS
Crédito CBS = CBS das Aquisições (integral)
CBS a Recolher = CBS Vendas - Crédito CBS
```

## 5. CAMPOS OBSERVAÇÃO NFe - INFORMAÇÕES OBRIGATÓRIAS

### 5.1 Cálculos Detalhados de Impostos

#### Simples Nacional:
```
"DOCUMENTO EMITIDO POR EMPRESA OPTANTE PELO SIMPLES NACIONAL.
ICMS devido conforme Anexo I da LC 123/2006.
Alíquota aplicada: X,XX% sobre receita bruta.
Valor ICMS: R$ XXX,XX
Base legal: Art. 18, §4º da LC 123/2006"
```

#### Lucro Presumido/Real:
```
"ICMS: Base R$ XXX,XX - Alíquota XX% - Valor R$ XXX,XX
PIS: Base R$ XXX,XX - Alíquota X,XX% - Valor R$ XXX,XX  
COFINS: Base R$ XXX,XX - Alíquota X,XX% - Valor R$ XXX,XX
IPI: Base R$ XXX,XX - Alíquota XX% - Valor R$ XXX,XX"
```

#### Substituição Tributária:
```
"ICMS SUBSTITUIÇÃO TRIBUTÁRIA CONFORME ART. 150, §7º DA CF/88
Base ST: R$ XXX,XX (MVA XX%)
ICMS ST: R$ XXX,XX
Responsável: [CNPJ/Nome do Substituto]"
```

### 5.2 Informações 2026 (IBS/CBS):

```
"TRIBUTOS REFORMA TRIBUTÁRIA - LC 214/2025:
IBS: Base R$ XXX,XX - Alíquota XX% - Valor R$ XXX,XX
CBS: Base R$ XXX,XX - Alíquota XX% - Valor R$ XXX,XX
IS: Base R$ XXX,XX - Alíquota XX% - Valor R$ XXX,XX (se aplicável)
Crédito IBS: R$ XXX,XX
Crédito CBS: R$ XXX,XX"
```

### 5.3 Informações por Regime Tributário

#### Dados Obrigatórios:
- Regime tributário da empresa
- Base legal dos tributos aplicados
- Alíquotas utilizadas
- Valores de créditos (quando aplicável)
- Observações específicas por operação

## 6. SEGURANÇA E COMUNICAÇÃO

### 6.1 Certificado Digital

#### Tipos Aceitos:
- **A1**: Arquivo .pfx/.p12 (validade 1 ano)
- **A3**: Token/cartão (validade 1-3 anos)

#### Validações:
- Verificação de validade
- Verificação de revogação
- Compatibilidade com CNPJ emitente

### 6.2 Comunicação Segura

#### Protocolos:
- **TLS 1.2+**: Obrigatório para todos os webservices
- **Assinatura Digital**: XML-DSig padrão W3C
- **Validação XSD**: Schemas oficiais SEFAZ

#### Webservices SEFAZ:
- NfeAutorizacao (emissão)
- NfeRetAutorizacao (consulta retorno)
- NfeConsultaProtocolo (consulta)
- NfeCancelamento (cancelamento)
- NfeInutilizacao (inutilização)
- RecepcaoEvento (CCe, manifestação)

### 6.3 Logs de Auditoria

#### Registros Obrigatórios:
- Todas as comunicações com SEFAZ
- Tentativas de emissão (sucesso/erro)
- Eventos de cancelamento/correção
- Acessos ao sistema
- Alterações de configuração

#### Retenção:
- Logs: Mínimo 5 anos
- XMLs: Mínimo 5 anos
- Certificados: Durante validade + 1 ano

## 7. AMBIENTE DE HOMOLOGAÇÃO vs PRODUÇÃO

### 7.1 Homologação

#### Características:
- CNPJ de teste: 11.222.333/0001-81
- Sem valor fiscal
- Testes de integração
- Validação de layouts

#### URLs Homologação (Exemplo SEFAZ Nacional):
```
https://hom.nfe.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx
https://hom.nfe.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx
```

### 7.2 Produção

#### Características:
- CNPJ real da empresa
- Valor fiscal legal
- Certificado válido obrigatório
- Numeração sequencial obrigatória

#### URLs Produção (Exemplo SEFAZ Nacional):
```
https://www.nfe.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx
https://www.nfe.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx
```

## 8. REFERÊNCIAS LEGAIS

### 8.1 Legislação Principal

- **Lei Complementar 214/2025**: Institui IBS, CBS e IS
- **Emenda Constitucional 132/2023**: Reforma Tributária
- **Nota Técnica 2025.002**: Adequações NFe/NFCe para IBS/CBS/IS
- **Ajuste SINIEF 11/2025**: NFC-e apenas para CPF
- **Ajuste SINIEF 12/2025**: NFe adaptada para varejo
- **Ajuste SINIEF 13/24**: Procedimentos de devolução
- **Ajuste SINIEF 14/24**: Não entrega/recusa

### 8.2 Portais Oficiais

- **Portal Nacional NFe**: https://www.nfe.fazenda.gov.br/
- **Receita Federal**: https://www.gov.br/receitafederal/
- **CONFAZ**: https://www.confaz.fazenda.gov.br/
- **ENCAT**: https://www.encat.org/

### 8.3 Manuais Técnicos

- Manual de Orientação do Contribuinte NFe v7.00
- Manual de Orientação do Contribuinte CTe v3.00
- Manual de Orientação do Contribuinte MDFe v3.00
- Schemas XML NFe 4.00
- Schemas XML CTe 4.00
- Schemas XML MDFe 3.00

---

**Documento atualizado em**: Dezembro 2024  
**Próxima revisão**: Janeiro 2025 (acompanhar implementação obrigatória IBS/CBS)  
**Responsável**: Sistema Brandão Contador NFe