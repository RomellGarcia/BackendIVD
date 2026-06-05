import { Router } from 'express'
import * as ResultadoController from '../controllers/resultado.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { validate }    from '../middlewares/validate.js'
import { createResultadoSchema, updateResultadoSchema } from '../schemas/resultado.schema.js'

const router = Router()

//Publicas
router.get('/',                           ResultadoController.getAll)
router.get('/estadisticas/generales',     ResultadoController.getEstadisticasGenerales)
router.get('/estadisticas/club/:clubId',  ResultadoController.getEstadisticasByClub)
router.get('/evento/:eventoId',           ResultadoController.getByEvento)
router.get('/atleta/:atletaId',           ResultadoController.getByAtleta)
router.get('/club/:clubId',               ResultadoController.getByClub)
router.get('/entrenador/:entrenadorId',   ResultadoController.getByEntrenador)
router.get('/:id',                        ResultadoController.getById)

//Admin
router.post('/',    requireAuth, validate(createResultadoSchema), ResultadoController.create)
router.put('/:id',  requireAuth, validate(updateResultadoSchema), ResultadoController.update)
router.delete('/:id', requireAuth, ResultadoController.remove)

export default router