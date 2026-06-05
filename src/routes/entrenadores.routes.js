import { Router } from 'express'
import * as EntrenadoresController from '../controllers/entrenadores.controller.js'
import { requireAuth }          from '../middlewares/auth.js'
import { validate }             from '../middlewares/validate.js'
import { updateSolicitudSchema } from '../schemas/entrenadores.schema.js'

const router = Router()

//Publicas
router.get('/club/:clubId', EntrenadoresController.getByClub)

//Protegidas (admin)
router.get('/solicitudes-club/:clubId', requireAuth, EntrenadoresController.getSolicitudesByClub)
router.put('/solicitudes/:solicitudId', requireAuth, validate(updateSolicitudSchema), EntrenadoresController.updateSolicitud)

export default router