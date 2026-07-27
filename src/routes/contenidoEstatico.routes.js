import { Router } from 'express'
import * as ContenidoController from '../controllers/contenidoEstatico.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { validate }    from '../middlewares/validate.js'
import { contenidoSchema } from '../schemas/contenidoEstatico.schema.js'

const router = Router()

// Obtiene contenido estático por tipo (mision, vision, politica, terminos)
router.get('/:tipo', ContenidoController.getByTipo)

// Actualiza o crea contenido estático (solo administradores)
router.put('/:tipo', requireAuth, validate(contenidoSchema), ContenidoController.upsert)

export default router