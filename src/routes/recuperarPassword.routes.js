import { Router } from 'express'
import * as RecuperarController from '../controllers/recuperarPassword.controller.js'

const router = Router()

// Solicita código de recuperación enviado al correo
router.post('/forgot-password', RecuperarController.forgotPassword)
// Verifica el código de recuperación
router.post('/verify-code', RecuperarController.verifyCode)
// Restablece la contraseña con el código verificado
router.post('/reset-password', RecuperarController.resetPassword)

export default router