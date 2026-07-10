import { Router } from 'express'
import * as EventoController from '../controllers/evento.controller.js'
import { requireAuth }   from '../middlewares/auth.js'
import { checkAtleta }   from '../middlewares/checkAtleta.js'
import { validate }      from '../middlewares/validate.js'
import {checkClub} from '../middlewares/checkClub.js'
import {
  createEventoSchema,
  addConvocatoriaSchema,
  updateFechaCierreSchema,
  inscripcionSchema
} from '../schemas/evento.schema.js'

const router = Router()

//Rutas especificas
router.get('/mis-convocatorias',  requireAuth, checkAtleta, EventoController.getConvocatoriasParaAtleta)
router.get('/mis-inscripciones',  requireAuth, checkAtleta, EventoController.getInscripcionesByAtleta)
router.post('/inscripciones',     requireAuth, checkAtleta, validate(inscripcionSchema), EventoController.inscribir)

router.get('/convocatorias-abiertas',    requireAuth, EventoController.getConvocatoriasAbiertas)
router.get('/mis-inscripciones-club',    requireAuth, checkClub, EventoController.getInscripcionesByClub)
router.post('/inscripciones/club',       requireAuth, checkClub, EventoController.inscribirAtletaClub)
router.delete('/inscripciones/:id', requireAuth, checkAtleta, EventoController.cancelarInscripcion)

//Rutas genericas
router.get('/',    EventoController.getAll)
router.get('/:id', EventoController.getById)
router.get('/:id/participantes', EventoController.getParticipantes)

//Admin
router.post('/',    requireAuth, validate(createEventoSchema),     EventoController.create)
router.post('/:id/convocatorias', requireAuth, validate(addConvocatoriaSchema), EventoController.addConvocatoria)
router.put('/:id/fecha-cierre',   requireAuth, validate(updateFechaCierreSchema), EventoController.updateFechaCierre)

export default router