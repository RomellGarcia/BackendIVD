import { Router } from 'express'
import { register, login, logout, me, changePassword } from '../controllers/auth.controller.js'
import { validate } from '../middlewares/validate.js'
import { requireAuth } from '../middlewares/auth.js'
import { registerSchema, loginSchema, changePasswordSchema } from '../schemas/auth.schema.js'

const router = Router()

// Registro de nuevo usuario
router.post('/register', validate(registerSchema), register)
// Inicio de sesión
router.post('/login', validate(loginSchema), login)
// Cierre de sesión (requiere autenticación)
router.post('/logout', requireAuth, logout)
// Obtener perfil del usuario autenticado
router.get('/me', requireAuth, me)
// Cambiar la contraseña del usuario autenticado
router.put('/password', requireAuth, validate(changePasswordSchema), changePassword)

export default router