const nodemailer = require('nodemailer');

async function sendTestEmail({ config, to }) {
  if (!config) {
    throw new Error('Configurações não encontradas');
  }

  const fromName = config?.empresa?.razaoSocial || 'Sistema NFe';
  const emailCfg = (config?.nfe?.emailEnvio) || (config?.notificacoes?.emailEnvio) || {};
  const servidor = emailCfg?.servidor;
  const porta = Number(emailCfg?.porta || 0);
  const usuario = emailCfg?.usuario;
  const senha = emailCfg?.senha;
  const ssl = Boolean(emailCfg?.ssl);

  const useSimulation = String(process.env.SIMULATION_MODE || '').toLowerCase() === 'true' || process.env.NODE_ENV !== 'production';

  async function sendWithEthereal() {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${testAccount.user}>`,
      to: to || testAccount.user,
      subject: 'Teste de envio de e-mail - Sistema NFe',
      text: 'Este é um e-mail de teste para validar a configuração SMTP.',
      html: '<p>Este é um <b>e-mail de teste</b> para validar a configuração SMTP.</p>'
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('Ethereal preview URL:', previewUrl);
    return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response, previewUrl, simulation: true };
  }

  if (useSimulation && (!servidor || !porta || !usuario || !senha)) {
    return await sendWithEthereal();
  }

  const transporter = nodemailer.createTransport({
    host: servidor,
    port: porta,
    secure: ssl,
    auth: { user: usuario, pass: senha },
    tls: { rejectUnauthorized: false }
  });

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${usuario}>`,
      to: to || usuario,
      subject: 'Teste de envio de e-mail - Sistema NFe',
      text: 'Este é um e-mail de teste para validar a configuração SMTP.',
      html: '<p>Este é um <b>e-mail de teste</b> para validar a configuração SMTP.</p>'
    });

    return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response, simulation: false };
  } catch (err) {
    if (useSimulation) {
      return await sendWithEthereal();
    }
    throw err;
  }
}

module.exports = { sendTestEmail };