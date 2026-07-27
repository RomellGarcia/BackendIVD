import { Router } from 'express'
import * as ResultadoController from '../controllers/resultado.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { createResultadoSchema, updateResultadoSchema, crearMasivoResultadoSchema } from '../schemas/resultado.schema.js'

const router = Router()

// Rutas públicas (listados y estadísticas)
router.get('/', ResultadoController.getAll) 
router.get('/estadisticas/generales', ResultadoController.getEstadisticasGenerales)
router.get('/estadisticas/club/:clubId', ResultadoController.getEstadisticasByClub)
router.get('/mejores-marcas', ResultadoController.getMejoresMarcas)
router.get('/evento/:eventoId', ResultadoController.getByEvento)
router.get('/atleta/:atletaId', ResultadoController.getByAtleta)
router.get('/club/:clubId', ResultadoController.getByClub)
router.get('/entrenador/:entrenadorId', ResultadoController.getByEntrenador) 
router.get('/convocatoria/:convocatoriaId', ResultadoController.getByConvocatoria) 
router.get('/:id', ResultadoController.getById) 

// Rutas administrativas (requieren autenticación)
router.post('/', requireAuth, validate(createResultadoSchema), ResultadoController.create)
router.post('/masivo', requireAuth, validate(crearMasivoResultadoSchema), ResultadoController.crearMasivo)
router.put('/:id', requireAuth, validate(updateResultadoSchema), ResultadoController.update)
router.delete('/convocatoria/:convocatoriaId', requireAuth, ResultadoController.removeByConvocatoria)
router.delete('/:id', requireAuth, ResultadoController.remove)

export default router