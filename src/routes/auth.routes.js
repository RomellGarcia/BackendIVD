import { Router } from 'express'
import { register, login, logout, me } from '../controllers/auth.controller.js'
import { validate } from '../middlewares/validate.js'
import { requireAuth } from '../middlewares/auth.js'
import { registerSchema, loginSchema } from '../schemas/auth.schema.js'

const router = Router()

// Registro de nuevo usuario
router.post('/register', validate(registerSchema), register)
// Inicio de sesión
router.post('/login', validate(loginSchema), login)
// Cierre de sesión (requiere autenticación)
router.post('/logout', requireAuth, logout)
// Obtener perfil del usuario autenticado
router.get('/me', requireAuth, me)

export default router