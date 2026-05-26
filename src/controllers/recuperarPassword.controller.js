// controllers/recuperarPassword.controller.js
// Usa Brevo (sib-api-v3-sdk) igual que el original
var pool   = require('../config/db');
var bcrypt = require('bcrypt');
var crypto = require('crypto');
var SibApiV3Sdk = require('sib-api-v3-sdk');

// Configurar Brevo
var defaultClient = SibApiV3Sdk.ApiClient.instance;
var apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

// Helper: buscar usuario en usuarios o clubes por email
function findUserByEmail(gmail) {
    var normalizado = gmail.toLowerCase();
    return pool.query(
        'SELECT id, email, password, reset_code, reset_code_expires, \'usuario\' AS coleccion FROM usuarios WHERE LOWER(email) = $1',
        [normalizado]
    ).then(function(r) {
        if (r.rows.length > 0) return { user: r.rows[0], coleccion: 'usuarios' };
        return pool.query(
            'SELECT id, email, password, reset_code, reset_code_expires, \'club\' AS coleccion FROM clubes WHERE LOWER(email) = $1',
            [normalizado]
        ).then(function(r2) {
            if (r2.rows.length > 0) return { user: r2.rows[0], coleccion: 'clubes' };
            return null;
        });
    });
}

// POST /api/recuperar/forgot-password
function forgotPassword(req, res) {
    var gmail = req.body.gmail;
    if (!gmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) {
        return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    var normalizado = gmail.toLowerCase();

    findUserByEmail(normalizado)
        .then(function(userResult) {
            if (!userResult) return Promise.reject({ status: 404, error: 'Correo no registrado' });

            var resetCode    = crypto.randomBytes(3).toString('hex').toUpperCase();
            var resetExpires = new Date(Date.now() + 3600000); // 1 hora

            var tabla = userResult.coleccion;
            return pool.query(
                'UPDATE ' + tabla + ' SET reset_code = $1, reset_code_expires = $2 WHERE id = $3',
                [resetCode, resetExpires, userResult.user.id]
            ).then(function() {
                // Enviar correo con Brevo
                var apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
                var sendSmtpEmail = {
                    sender: { email: process.env.BREVO_SENDER, name: 'Instituto Veracruzano del Deporte' },
                    to: [{ email: normalizado }],
                    subject: 'Recuperación de contraseña - Instituto Veracruzano del Deporte',
                    htmlContent: `
                        <div style="font-family:Arial,sans-serif;color:#222;background:#f9f9f9;padding:24px;border-radius:8px;max-width:500px;margin:auto;">
                            <div style="text-align:center;margin-bottom:16px;">
                                <img src="https://www.ivd.gob.mx/wp-content/uploads/2022/01/LOGO-IVD-2022.png" alt="IVD" style="max-width:120px;"/>
                            </div>
                            <h2 style="color:#800020;text-align:center;">Recuperación de contraseña</h2>
                            <p>Tu código de recuperación es:</p>
                            <div style="text-align:center;margin:24px 0;">
                                <span style="font-size:2rem;font-weight:bold;color:#800020;letter-spacing:2px;">${resetCode}</span>
                            </div>
                            <p>Este código es válido por <strong>1 hora</strong>.</p>
                            <p style="color:#b00;font-size:.95rem;">Por tu seguridad, no compartas este código con nadie.</p>
                        </div>
                    `
                };
                return apiInstance.sendTransacEmail(sendSmtpEmail);
            });
        })
        .then(function() {
            res.json({ message: 'Código enviado a tu correo' });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al enviar código:', err);
            res.status(500).json({ error: 'Error al procesar la solicitud', details: err.message });
        });
}

// POST /api/recuperar/verify-code
function verifyCode(req, res) {
    var gmail = req.body.gmail;
    var code  = req.body.code;

    if (!gmail || !code) return res.status(400).json({ error: 'Faltan datos' });

    findUserByEmail(gmail.toLowerCase())
        .then(function(userResult) {
            if (!userResult || !userResult.user.reset_code || !userResult.user.reset_code_expires) {
                return Promise.reject({ status: 400, error: 'Código no solicitado o expirado' });
            }
            if (userResult.user.reset_code !== code || new Date(userResult.user.reset_code_expires) < new Date()) {
                return Promise.reject({ status: 400, error: 'Código incorrecto o expirado' });
            }
            res.json({ success: true, message: 'Código válido', coleccion: userResult.coleccion });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            res.status(500).json({ error: 'Error al verificar código', details: err.message });
        });
}

// POST /api/recuperar/reset-password
function resetPassword(req, res) {
    var gmail       = req.body.gmail;
    var code        = req.body.code;
    var newPassword = req.body.newPassword;

    if (!gmail || !code || !newPassword) return res.status(400).json({ error: 'Faltan datos' });

    findUserByEmail(gmail.toLowerCase())
        .then(function(userResult) {
            if (!userResult || !userResult.user.reset_code || !userResult.user.reset_code_expires) {
                return Promise.reject({ status: 400, error: 'Código no solicitado o expirado' });
            }
            if (userResult.user.reset_code !== code || new Date(userResult.user.reset_code_expires) < new Date()) {
                return Promise.reject({ status: 400, error: 'Código incorrecto o expirado' });
            }
            return bcrypt.hash(newPassword, 10).then(function(hash) {
                return pool.query(
                    'UPDATE ' + userResult.coleccion + ' SET password=$1, reset_code=NULL, reset_code_expires=NULL WHERE id=$2',
                    [hash, userResult.user.id]
                );
            });
        })
        .then(function() {
            res.json({ success: true, message: 'Contraseña actualizada con éxito' });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            res.status(500).json({ error: 'Error al resetear contraseña', details: err.message });
        });
}

module.exports = { forgotPassword, verifyCode, resetPassword };
