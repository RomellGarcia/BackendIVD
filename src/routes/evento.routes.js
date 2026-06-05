import { Router } from 'express'
import * as EventoController from '../controllers/evento.controller.js'
import { requireAuth }   from '../middlewares/auth.js'
import { checkAtleta }   from '../middlewares/checkAtleta.js'
import { validate }      from '../middlewares/validate.js'
import {
  createEventoSchema,
  addConvocatoriaSchema,
  updateFechaCierreSchema,
  inscripcionSchema
} from '../schemas/evento.schema.js'

const router = Router()

//Publicas
router.get('/',    EventoController.getAll)
router.get('/:id', EventoController.getById)
router.get('/:id/participantes', EventoController.getParticipantes)

//Atleta autenticado
router.get('/mis-convocatorias',  requireAuth, checkAtleta, EventoController.getConvocatoriasParaAtleta)
router.get('/mis-inscripciones',  requireAuth, checkAtleta, EventoController.getInscripcionesByAtleta)
router.post('/inscripciones',     requireAuth, checkAtleta, validate(inscripcionSchema), EventoController.inscribir)

//Admin
router.post('/',    requireAuth, validate(createEventoSchema),     EventoController.create)
router.post('/:id/convocatorias', requireAuth, validate(addConvocatoriaSchema), EventoController.addConvocatoria)
router.put('/:id/fecha-cierre',   requireAuth, validate(updateFechaCierreSchema), EventoController.updateFechaCierre)

export default router