const express = require('express');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const router = express.Router();

// Configurar cliente de Brevo
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

// Utilidad para buscar usuario en ambas colecciones
async function findUserByEmail(db, gmail) {
  let user = await db.collection('registro').findOne({ gmail: { $regex: `^${gmail}$`, $options: 'i' } });
  if (user) return { user, collection: 'registro' };
  user = await db.collection('club').findOne({ gmail: { $regex: `^${gmail}$`, $options: 'i' } });
  if (user) return { user, collection: 'club' };
  return null;
}

// 1. Solicitar código de recuperación
router.post('/forgot-password', async (req, res) => {
  const { gmail } = req.body;
  if (!gmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) {
    return res.status(400).json({ error: 'Correo electrónico inválido' });
  }
  const normalizedGmail = gmail.toLowerCase();
  const { db } = req;
  const userResult = await findUserByEmail(db, normalizedGmail);
  if (!userResult) {
    return res.status(404).json({ error: 'Correo no registrado' });
  }
  const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  const resetCodeExpires = new Date(Date.now() + 3600000);
  await db.collection(userResult.collection).updateOne(
    { gmail: { $regex: `^${normalizedGmail}$`, $options: 'i' } },
    { $set: { resetCode, resetCodeExpires } }
  );
  // Enviar correo con Brevo API
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const sendSmtpEmail = {
    sender: { email: process.env.BREVO_SENDER, name: 'Instituto Veracruzano del Deporte' },
    to: [{ email: normalizedGmail }],
    subject: 'Recuperación de contraseña - Instituto Veracruzano del Deporte',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; color: #222; background: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 500px; margin: auto;">
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="https://www.ivd.gob.mx/wp-content/uploads/2022/01/LOGO-IVD-2022.png" alt="Instituto Veracruzano del Deporte" style="max-width: 120px; margin-bottom: 8px;"/>
        </div>
        <h2 style="color: #800020; text-align: center;">Recuperación de contraseña</h2>
        <p>Hola,</p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta registrada en el <strong>Instituto Veracruzano del Deporte</strong>.</p>
        <p>Tu código de recuperación es:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 2rem; font-weight: bold; color: #800020; letter-spacing: 2px;">${resetCode}</span>
        </div>
        <p>Este código es válido por <strong>1 hora</strong>. Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
        <p style="color: #b00; font-size: 0.95rem;">Por tu seguridad, no compartas este código con nadie.</p>
        <hr style="margin: 24px 0;"/>
        <p style="font-size: 0.95rem; color: #555;">Si tienes dudas o necesitas ayuda, contáctanos en <a href="mailto:soporte@ivd.gob.mx">soporte@ivd.gob.mx</a>.<br/>Gracias por confiar en el Instituto Veracruzano del Deporte.</p>
      </div>
    `,
  };
  await apiInstance.sendTransacEmail(sendSmtpEmail);
  res.json({ message: 'Código enviado a tu correo' });
});

// 2. Verificar código
router.post('/verify-code', async (req, res) => {
  const { gmail, code } = req.body;
  if (!gmail || !code) return res.status(400).json({ error: 'Faltan datos' });
  const normalizedGmail = gmail.toLowerCase();
  const { db } = req;
  const userResult = await findUserByEmail(db, normalizedGmail);
  if (!userResult || !userResult.user.resetCode || !userResult.user.resetCodeExpires) {
    return res.status(400).json({ error: 'Código no solicitado o expirado' });
  }
  if (userResult.user.resetCode !== code || userResult.user.resetCodeExpires < new Date()) {
    return res.status(400).json({ error: 'Código incorrecto o expirado' });
  }
  res.json({ success: true, message: 'Código válido', collection: userResult.collection });
});

// 3. Cambiar contraseña
router.post('/reset-password', async (req, res) => {
  const { gmail, code, newPassword } = req.body;
  if (!gmail || !code || !newPassword) return res.status(400).json({ error: 'Faltan datos' });
  const normalizedGmail = gmail.toLowerCase();
  const { db } = req;
  const userResult = await findUserByEmail(db, normalizedGmail);
  if (!userResult || !userResult.user.resetCode || !userResult.user.resetCodeExpires) {
    return res.status(400).json({ error: 'Código no solicitado o expirado' });
  }
  if (userResult.user.resetCode !== code || userResult.user.resetCodeExpires < new Date()) {
    return res.status(400).json({ error: 'Código incorrecto o expirado' });
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.collection(userResult.collection).updateOne(
    { gmail: { $regex: `^${normalizedGmail}$`, $options: 'i' } },
    { $set: { password: hashedPassword }, $unset: { resetCode: '', resetCodeExpires: '' } }
  );
  res.json({ success: true, message: 'Contraseña actualizada con éxito' });
});

module.exports = router; 