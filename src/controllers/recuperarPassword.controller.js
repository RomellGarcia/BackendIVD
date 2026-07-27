import * as RecuperarModel from '../models/recuperarPassword.model.js'
import { sendPasswordResetEmail } from '../services/email.service.js'

// Solicita un código de recuperación enviado al correo del usuario
export const forgotPassword = async (req, res, next) => {
  try {
    const { gmail } = req.body
    if (!gmail) return res.status(400).json({ error: 'Falta el correo electrónico' })

    const usuario = await RecuperarModel.findUsuarioPorEmail(gmail)
    // Respuesta para no revela si el correo existe o no
    if (usuario) {
      const codigo = await RecuperarModel.crearCodigo(gmail)
      // Envía el correo en segundo plano
      sendPasswordResetEmail({ to: gmail, nombre: usuario.nombre, codigo })
        .catch(err => console.error('Error al enviar correo de recuperación:', err.message))
    }

    res.json({ mensaje: 'Si el correo está registrado, recibirás un código en unos minutos.' })
  } catch (err) { next(err) }
}

// Verifica si el código ingresado es válido y no ha expirado
export const verifyCode = async (req, res, next) => {
  try {
    const { gmail, code } = req.body
    if (!gmail || !code) return res.status(400).json({ error: 'Faltan datos' })

    const codigoValido = await RecuperarModel.validarCodigo(gmail, code)
    if (!codigoValido) return res.status(400).json({ error: 'Código incorrecto o expirado' })

    res.json({ mensaje: 'Código verificado' })
  } catch (err) { next(err) }
}

// Cambia la contraseña del usuario usando el código verificado
export const resetPassword = async (req, res, next) => {
  try {
    const { gmail, code, newPassword } = req.body
    if (!gmail || !code || !newPassword) return res.status(400).json({ error: 'Faltan datos' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

    const codigoValido = await RecuperarModel.validarCodigo(gmail, code)
    if (!codigoValido) return res.status(400).json({ error: 'Código incorrecto o expirado' })

    const usuario = await RecuperarModel.findUsuarioPorEmail(gmail)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    // Actualiza la contraseña en Supabase Auth
    await RecuperarModel.actualizarPasswordSupabase(usuario.supabase_uid, newPassword)
    // Marca el código como usado para que no se reutilice
    await RecuperarModel.marcarCodigoUsado(codigoValido.id)

    res.json({ mensaje: 'Contraseña actualizada correctamente' })
  } catch (err) { next(err) }
}