import { Router } from 'express'
import * as PerfilController from '../controllers/perfilEmpresa.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { updatePerfilSchema } from '../schemas/perfilEmpresa.schema.js'

const router = Router()

// Obtiene el perfil de la empresa (público)
router.get('/', PerfilController.get)

// Actualiza los datos del perfil (requiere autenticación)
router.put('/', requireAuth, validate(updatePerfilSchema), PerfilController.update)

// Actualiza el logo de la empresa (requiere autenticación)
router.put('/logo', requireAuth, PerfilController.updateLogo)

export default router