import { Router } from 'express'
import * as EventoController from '../controllers/evento.controller.js'
import { requireAuth }   from '../middlewares/auth.js'
import { checkAtleta }   from '../middlewares/checkAtleta.js'
import { checkClub }     from '../middlewares/checkClub.js'
import { validate }      from '../middlewares/validate.js'

import {
  createEventoSchema,
  addConvocatoriaSchema,
  updateFechaCierreSchema,
  updateConvocatoriaSchema,
  inscripcionSchema
} from '../schemas/evento.schema.js'
import { checkAdmin } from '../middlewares/checkAdmin.js'

const router = Router()


const parseConvocatorias = (req, res, next) => {
  if (typeof req.body.convocatorias === 'string') {
    try {
      req.body.convocatorias = JSON.parse(req.body.convocatorias)
    } catch {
      return res.status(400).json({ error: 'convocatorias debe ser un JSON válido' })
    }
  }
  next()
}

//Rutas especificas
router.get('/mis-convocatorias',  requireAuth, checkAtleta, EventoController.getConvocatoriasParaAtleta)
router.get('/mis-inscripciones',  requireAuth, checkAtleta, EventoController.getInscripcionesByAtleta)
router.post('/inscripciones',     requireAuth, checkAtleta, validate(inscripcionSchema), EventoController.inscribir)
router.delete('/inscripciones/:id', requireAuth, checkAtleta, EventoController.cancelarInscripcion)

router.get('/convocatorias-abiertas', requireAuth, EventoController.getConvocatoriasAbiertas)
router.get('/mis-inscripciones-club', requireAuth, checkClub, EventoController.getInscripcionesByClub)
router.post('/inscripciones/club',    requireAuth, checkClub, EventoController.inscribirAtletaClub)

//Rutas genericas
router.get('/',    EventoController.getAll)
router.get('/:id', EventoController.getById)
router.get('/:id/participantes', EventoController.getParticipantes)



//Admin
router.post('/', requireAuth, parseConvocatorias, validate(createEventoSchema), EventoController.create)
router.post('/:id/convocatorias', requireAuth, validate(addConvocatoriaSchema), EventoController.addConvocatoria)
router.put('/:id/fecha-cierre',   requireAuth, validate(updateFechaCierreSchema), EventoController.updateFechaCierre)
router.put('/:id',                              requireAuth, checkAdmin, EventoController.update)
router.put('/:id/estado',                        requireAuth, checkAdmin, EventoController.toggleEstado)
router.patch('/:id/finalizar',                   requireAuth, checkAdmin, EventoController.toggleFinalizadoEvento)
router.delete('/:id',                             requireAuth, checkAdmin, EventoController.deleteEvento)
router.delete('/convocatorias/:convocatoriaId',   requireAuth, checkAdmin, EventoController.deleteConvocatoria)
router.delete('/participantes/:inscripcionId',    requireAuth, checkAdmin, EventoController.removerAtletaDeConvocatoria)


router.get('/:id/convocatorias',                         EventoController.getConvocatoriasDeEvento)
router.post('/convocatorias/:convocatoriaId/resultado',   requireAuth, checkAdmin, EventoController.subirResultadoConvocatoria)
router.delete('/convocatorias/:convocatoriaId/resultado', requireAuth, checkAdmin, EventoController.eliminarResultadoConvocatoria)

router.get('/convocatorias/:convocatoriaId/participantes', EventoController.getParticipantesPorConvocatoria)
router.put('/convocatorias/:convocatoriaId', requireAuth, checkAdmin, validate(updateConvocatoriaSchema), EventoController.updateConvocatoria)

router.patch('/convocatorias/:convocatoriaId/estado', requireAuth, checkAdmin, EventoController.toggleEstadoConvocatoria)

export default router