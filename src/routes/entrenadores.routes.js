import { Router } from 'express'
import * as EntrenadoresController from '../controllers/entrenadores.controller.js'
import { requireAuth }          from '../middlewares/auth.js'
import { checkAdmin }           from '../middlewares/checkAdmin.js'
import { checkClub }            from '../middlewares/checkClub.js'
import { checkAdminOClub }      from '../middlewares/checkAdminOClub.js'
import { checkClubOEntrenador } from '../middlewares/checkClubOEntrenador.js'
import { validate }             from '../middlewares/validate.js'
import {
  updateSolicitudSchema,
  updateAdminEntrenadorSchema,
  updateClubEntrenadorSchema
} from '../schemas/entrenadores.schema.js'

const router = Router()

// Rutas públicas
router.get('/', EntrenadoresController.getAll) 
router.get('/club/:clubId', EntrenadoresController.getByClub)

// Rutas protegidas (requieren autenticación)
router.get('/solicitudes-club/:clubId', requireAuth, EntrenadoresController.getSolicitudesByClub) 
router.put('/solicitudes/:solicitudId', requireAuth, checkClubOEntrenador, validate(updateSolicitudSchema), EntrenadoresController.updateSolicitud) 
router.put('/:id', requireAuth, checkAdmin, validate(updateAdminEntrenadorSchema), EntrenadoresController.updateAdmin)
router.put('/:id/club', requireAuth, checkAdminOClub, validate(updateClubEntrenadorSchema), EntrenadoresController.updateClub)
router.post('/:id/invitar-club', requireAuth, checkClub, EntrenadoresController.invitarClub) 
router.get('/:id', requireAuth, EntrenadoresController.getById)
router.delete('/:id', requireAuth, checkAdmin, EntrenadoresController.remove)

export default router