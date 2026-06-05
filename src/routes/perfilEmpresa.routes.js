import { Router } from 'express'
import * as PerfilController from '../controllers/perfilEmpresa.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { validate }    from '../middlewares/validate.js'
import { updatePerfilSchema } from '../schemas/perfilEmpresa.schema.js'

const router = Router()

router.get('/', PerfilController.get)

router.put('/',     requireAuth, validate(updatePerfilSchema), PerfilController.update)
router.put('/logo', requireAuth, PerfilController.updateLogo)

export default router