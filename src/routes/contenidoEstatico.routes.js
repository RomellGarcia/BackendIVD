import { Router } from 'express'
import * as ContenidoController from '../controllers/contenidoEstatico.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { validate }    from '../middlewares/validate.js'
import { contenidoSchema } from '../schemas/contenidoEstatico.schema.js'

const router = Router()

// Pública — cualquiera puede leer misión, visión, etc.
router.get('/:tipo', ContenidoController.getByTipo)

// Solo admin puede actualizar
router.put('/:tipo', requireAuth, validate(contenidoSchema), ContenidoController.upsert)

export default router