#!/bin/bash

# Backup do arquivo original
cp middleware/auth.js middleware/auth.js.backup2

# Encontrar e substituir a função verificarPermissao
sed -i '/verificarPermissao(permissaoRequerida) {/,/^  }/c\
  verificarPermissao(permissaoRequerida) {\
    return (req, res, next) => {\
      try {\
        if (!req.usuario) {\
          return res.status(401).json({\
            sucesso: false,\
            erro: " Autenticação necessária\,\
 codigo: \AUTENTICACAO_NECESSARIA\\
 });\
 }\
\
 // API Key tem permissões específicas\
 if (req.tipoAuth === \api-key\) {\
 const permissoesApiKey = [\nfe_consultar\, \nfe_emitir\, \nfe_cancelar\];\
 if (!permissoesApiKey.includes(permissaoRequerida)) {\
 return res.status(403).json({\
 sucesso: false,\
 erro: \Permissão insuficiente para API Key\,\
 codigo: \PERMISSAO_INSUFICIENTE\\
 });\
 }\
 return next();\
 }\
\
 // Verificar tipo de usuário e permissões\
 const tipoUsuario = req.usuario.tipo || \cliente\;\
 const permissoes = req.usuario.permissoes || [];\
\
 // ADMINISTRADOR: Acesso total e irrestrito\
 if (tipoUsuario === \admin\ || permissoes.includes(\*\)) {\
 return next();\
 }\
\
 // CLIENTE: Acesso limitado às próprias funcionalidades\
 if (tipoUsuario === \cliente\ || tipoUsuario === \user\) {\
 const permissoesCliente = [\
 \nfe_emitir\, \nfe_consultar\, \nfe_cancelar\,\
 \cte_emitir\, \cte_consultar\, \cte_cancelar\,\
 \mdfe_emitir\, \mdfe_consultar\, \mdfe_cancelar\,\
 \relatorios_proprios\,\
 \configuracoes_empresa\\
 ];\
\
 // Verificar se a permissão requerida está na lista de permissões do cliente\
 if (!permissoesCliente.includes(permissaoRequerida)) {\
 return res.status(403).json({\
 sucesso: false,\
 erro: \Acesso negado. Permissão \\\ não disponível para clientes\,\
 codigo: \PERMISSAO_INSUFICIENTE\\
 });\
 }\
\
 // Verificar se o usuário tem a permissão específica\
 if (!permissoes.includes(permissaoRequerida)) {\
 return res.status(403).json({\
 sucesso: false,\
 erro: \Permissão \\\ necessária\,\
 codigo: \PERMISSAO_INSUFICIENTE\\
 });\
 }\
 }\
\
 next();\
\
 } catch (error) {\
 console.error(" Erro na verificação de permissão:\, error);\
        res.status(500).json({\
          sucesso: false,\
          erro: \Erro interno no servidor\,\
          codigo: \ERRO_INTERNO\\
        });\
      }\
    };\
  }' middleware/auth.js

echo Função verificarPermissao atualizada com sucesso!
