const nodemailer = require("nodemailer");

/**
 * Envia email usando configurações reais de SMTP
 * @param {Object} params - Parâmetros do email
 * @param {Object} params.config - Configurações do sistema
 * @param {string} params.to - Destinatário
 * @param {string} params.subject - Assunto
 * @param {string} params.text - Texto simples
 * @param {string} params.html - HTML do email
 * @param {Array} params.attachments - Anexos (opcional)
 */
async function sendEmail({
  config,
  to,
  subject,
  text,
  html,
  attachments = [],
}) {
  if (!config) {
    throw new Error("Configurações não encontradas");
  }

  const fromName = config?.empresa?.razaoSocial || "Sistema NFe";
  const emailCfg =
    config?.nfe?.emailEnvio || config?.notificacoes?.emailEnvio || {};

  const servidor = emailCfg?.servidor;
  const porta = Number(emailCfg?.porta || 587);
  const usuario = emailCfg?.usuario;
  const senha = emailCfg?.senha;
  const ssl = Boolean(emailCfg?.ssl);

  if (!servidor || !usuario || !senha) {
    throw new Error(
      "Configurações de email incompletas. Verifique servidor, usuário e senha.",
    );
  }

  const transporter = nodemailer.createTransporter({
    host: servidor,
    port: porta,
    secure: ssl,
    auth: { user: usuario, pass: senha },
    tls: { rejectUnauthorized: false },
  });

  // Verificar conexão
  await transporter.verify();

  const info = await transporter.sendMail({
    from: `"${fromName}" <${usuario}>`,
    to: to,
    subject: subject,
    text: text,
    html: html,
    attachments: attachments,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}

/**
 * Envia NFe por email
 * @param {Object} params - Parâmetros
 * @param {Object} params.config - Configurações
 * @param {string} params.destinatario - Email do destinatário
 * @param {Object} params.nfe - Dados da NFe
 * @param {string} params.xmlPath - Caminho do XML
 * @param {string} params.pdfPath - Caminho do PDF
 */
async function sendNfeEmail({ config, destinatario, nfe, xmlPath, pdfPath }) {
  const attachments = [];

  if (xmlPath) {
    attachments.push({
      filename: `NFe_${nfe.numero}.xml`,
      path: xmlPath,
    });
  }

  if (pdfPath) {
    attachments.push({
      filename: `NFe_${nfe.numero}.pdf`,
      path: pdfPath,
    });
  }

  const subject = `NFe ${nfe.numero} - ${config?.empresa?.razaoSocial || "Sistema NFe"}`;
  const html = `
    <h2>Nota Fiscal Eletrônica</h2>
    <p><strong>Número:</strong> ${nfe.numero}</p>
    <p><strong>Série:</strong> ${nfe.serie}</p>
    <p><strong>Data de Emissão:</strong> ${new Date(nfe.dataEmissao).toLocaleDateString("pt-BR")}</p>
    <p><strong>Valor Total:</strong> R$ ${nfe.valorTotal?.toFixed(2) || "0,00"}</p>
    <br>
    <p>Em anexo seguem os arquivos XML e PDF da Nota Fiscal.</p>
    <p><em>Este é um email automático, não responda.</em></p>
  `;

  return await sendEmail({
    config,
    to: destinatario,
    subject,
    text: `NFe ${nfe.numero} em anexo`,
    html,
    attachments,
  });
}

module.exports = { sendEmail, sendNfeEmail };
