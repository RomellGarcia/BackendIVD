import { Router } from 'express'
import * as EventoController from '../controllers/evento.controller.js'
import { requireAuth }   from '../middlewares/auth.js'
import { checkAtleta }   from '../middlewares/checkAtleta.js'
import { checkClub }     from '../middlewares/checkClub.js'
import { checkAdmin }    from '../middlewares/checkAdmin.js'
import { validate }      from '../middlewares/validate.js'
import {
  createEventoSchema,
  addConvocatoriaSchema,
  updateFechaCierreSchema,
  updateConvocatoriaSchema,
  inscripcionSchema
} from '../schemas/evento.schema.js'

const router = Router()

// Middleware para parsear convocatorias si vienen como string JSON
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

// Rutas para atletas (inscripciones y convocatorias propias)
router.get('/mis-convocatorias',  requireAuth, checkAtleta, EventoController.getConvocatoriasParaAtleta)
router.get('/mis-inscripciones',  requireAuth, checkAtleta, EventoController.getInscripcionesByAtleta)
router.post('/inscripciones',     requireAuth, checkAtleta, validate(inscripcionSchema), EventoController.inscribir)
router.delete('/inscripciones/:id', requireAuth, checkAtleta, EventoController.cancelarInscripcion)

// Rutas para clubes (inscripciones de sus atletas)
router.get('/mis-inscripciones-club', requireAuth, checkClub, EventoController.getInscripcionesByClub)
router.post('/inscripciones/club',    requireAuth, checkClub, EventoController.inscribirAtletaClub)

// Convocatorias abiertas (requiere autenticación)
router.get('/convocatorias-abiertas', requireAuth, EventoController.getConvocatoriasAbiertas)

// Rutas públicas (listado y detalle de eventos)
router.get('/',    EventoController.getAll)
router.get('/:id', EventoController.getById)
router.get('/:id/participantes', EventoController.getParticipantes)

// Rutas de administración (creación, edición, eliminación de eventos y convocatorias)
router.post('/', requireAuth, parseConvocatorias, validate(createEventoSchema), EventoController.create)
router.post('/:id/convocatorias', requireAuth, validate(addConvocatoriaSchema), EventoController.addConvocatoria)
router.put('/:id/fecha-cierre',   requireAuth, validate(updateFechaCierreSchema), EventoController.updateFechaCierre)
router.put('/:id',                requireAuth, checkAdmin, EventoController.update)
router.put('/:id/estado',         requireAuth, checkAdmin, EventoController.toggleEstado)
router.patch('/:id/finalizar',    requireAuth, checkAdmin, EventoController.toggleFinalizadoEvento)
router.delete('/:id',             requireAuth, checkAdmin, EventoController.deleteEvento)
router.delete('/convocatorias/:convocatoriaId', requireAuth, checkAdmin, EventoController.deleteConvocatoria)
router.delete('/participantes/:inscripcionId',  requireAuth, checkAdmin, EventoController.removerAtletaDeConvocatoria)

// Gestión de convocatorias (listado, resultados, actualización)
router.get('/:id/convocatorias', EventoController.getConvocatoriasDeEvento)
router.post('/convocatorias/:convocatoriaId/resultado', requireAuth, checkAdmin, EventoController.subirResultadoConvocatoria)
router.delete('/convocatorias/:convocatoriaId/resultado', requireAuth, checkAdmin, EventoController.eliminarResultadoConvocatoria)
router.get('/convocatorias/:convocatoriaId/participantes', EventoController.getParticipantesPorConvocatoria)
router.put('/convocatorias/:convocatoriaId', requireAuth, checkAdmin, validate(updateConvocatoriaSchema), EventoController.updateConvocatoria)
router.patch('/convocatorias/:convocatoriaId/estado', requireAuth, checkAdmin, EventoController.toggleEstadoConvocatoria)

export default router