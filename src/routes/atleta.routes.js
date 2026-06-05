import { Router } from 'express'
import * as AtletaController from '../controllers/atleta.controller.js'
import { requireAuth }   from '../middlewares/auth.js'
import { checkAtleta }   from '../middlewares/checkAtleta.js'
import { validate }      from '../middlewares/validate.js'
import {
  updatePerfilAtletaSchema,
  solicitudClubSchema,
  procesarSolicitudSchema,
  updateClubAtletaSchema
} from '../schemas/atleta.schema.js'

const router = Router()

//Publicas
router.get('/',     AtletaController.getAll)
router.get('/:id',  AtletaController.getById)

//Atleta 
router.get('/perfil',  requireAuth, checkAtleta, AtletaController.getPerfil)
router.put('/perfil',  requireAuth, checkAtleta, validate(updatePerfilAtletaSchema), AtletaController.updatePerfil)

router.post('/solicitudes-club',     requireAuth, checkAtleta, validate(solicitudClubSchema),    AtletaController.crearSolicitudClub)
router.get('/solicitudes-club',      requireAuth, AtletaController.getSolicitudesClub)
router.put('/solicitudes-club/:id',  requireAuth, validate(procesarSolicitudSchema), AtletaController.procesarSolicitudClub)

//Admin
router.put('/:id/club',  requireAuth, validate(updateClubAtletaSchema), AtletaController.updateClub)
router.delete('/:id',    requireAuth, AtletaController.remove)

export default router