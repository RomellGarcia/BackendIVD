import { Router } from 'express'
import * as EntrenadoresController from '../controllers/entrenadores.controller.js'
import { requireAuth }          from '../middlewares/auth.js'
import { checkAdmin }           from '../middlewares/checkAdmin.js'
import { validate }             from '../middlewares/validate.js'
import {
  updateSolicitudSchema,
  updateAdminEntrenadorSchema,
  updateClubEntrenadorSchema
} from '../schemas/entrenadores.schema.js'

const router = Router()

//Publicas
router.get('/', EntrenadoresController.getAll)
router.get('/club/:clubId', EntrenadoresController.getByClub)

//Protegidas (admin)
router.get('/solicitudes-club/:clubId', requireAuth, EntrenadoresController.getSolicitudesByClub)
router.put('/solicitudes/:solicitudId', requireAuth, validate(updateSolicitudSchema), EntrenadoresController.updateSolicitud)
router.put('/:id',       requireAuth, checkAdmin, validate(updateAdminEntrenadorSchema), EntrenadoresController.updateAdmin)
router.put('/:id/club',  requireAuth, checkAdmin, validate(updateClubEntrenadorSchema), EntrenadoresController.updateClub)

export default router