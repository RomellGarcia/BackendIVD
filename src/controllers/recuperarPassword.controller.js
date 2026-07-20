import * as RecuperarModel from '../models/recuperarPassword.model.js'
import { sendPasswordResetEmail } from '../services/email.service.js'

export const forgotPassword = async (req, res, next) => {
  try {
    const { gmail } = req.body
    if (!gmail) return res.status(400).json({ error: 'Falta el correo electrónico' })

    const usuario = await RecuperarModel.findUsuarioPorEmail(gmail)

    // Por seguridad, respondemos igual exista o no la cuenta -- así este
    // endpoint no se puede usar para averiguar qué correos están registrados.
    if (usuario) {
      const codigo = await RecuperarModel.crearCodigo(gmail)
      sendPasswordResetEmail({ to: gmail, nombre: usuario.nombre, codigo })
        .catch(err => console.error('Error al enviar correo de recuperación:', err.message))
    }

    res.json({ mensaje: 'Si el correo está registrado, recibirás un código en unos minutos.' })
  } catch (err) { next(err) }
}

export const verifyCode = async (req, res, next) => {
  try {
    const { gmail, code } = req.body
    if (!gmail || !code) return res.status(400).json({ error: 'Faltan datos' })

    const registro = await RecuperarModel.validarCodigo(gmail, code)
    if (!registro) return res.status(400).json({ error: 'Código incorrecto o expirado' })

    res.json({ mensaje: 'Código verificado' })
  } catch (err) { next(err) }
}

export const resetPassword = async (req, res, next) => {
  try {
    const { gmail, code, newPassword } = req.body
    if (!gmail || !code || !newPassword) return res.status(400).json({ error: 'Faltan datos' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

    const registro = await RecuperarModel.validarCodigo(gmail, code)
    if (!registro) return res.status(400).json({ error: 'Código incorrecto o expirado' })

    const usuario = await RecuperarModel.findUsuarioPorEmail(gmail)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })

    await RecuperarModel.actualizarPasswordSupabase(usuario.supabase_uid, newPassword)
    await RecuperarModel.marcarCodigoUsado(registro.id)

    res.json({ mensaje: 'Contraseña actualizada correctamente' })
  } catch (err) { next(err) }
}