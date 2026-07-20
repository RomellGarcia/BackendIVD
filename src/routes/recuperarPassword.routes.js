import { Router } from 'express'
import * as RecuperarController from '../controllers/recuperarPassword.controller.js'

const router = Router()

router.post('/forgot-password', RecuperarController.forgotPassword)
router.post('/verify-code', RecuperarController.verifyCode)
router.post('/reset-password', RecuperarController.resetPassword)

export default router