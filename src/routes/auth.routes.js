import { Router } from 'express'
import { register, login, logout, me } from '../controllers/auth.controller.js'
import { validate } from '../middlewares/validate.js'
import { requireAuth } from '../middlewares/auth.js'
import { registerSchema, loginSchema } from '../schemas/auth.schema.js'

const router = Router()

router.post('/register', validate(registerSchema), register)
router.post('/login',    validate(loginSchema),    login)
router.post('/logout',   requireAuth,              logout)
router.get('/me',        requireAuth,              me)

export default router