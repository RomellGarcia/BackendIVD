import { Router } from 'express'
import * as AtletaController from '../controllers/atleta.controller.js'
import { requireAuth }   from '../middlewares/auth.js'
import { checkAtleta }   from '../middlewares/checkAtleta.js'
import { checkAdmin }    from '../middlewares/checkAdmin.js'
import { validate }      from '../middlewares/validate.js'
import {
  updatePerfilAtletaSchema,
  solicitudClubSchema,
  procesarSolicitudSchema,
  updateClubAtletaSchema,
  updateAdminAtletaSchema
} from '../schemas/atleta.schema.js'
import { checkClub } from '../middlewares/checkClub.js'

console.log('invitarClub es:', typeof AtletaController.invitarClub, '| checkAdmin es:', typeof checkAdmin)

const router = Router()

//Rutas especificas
router.get('/perfil',         requireAuth, checkAtleta, AtletaController.getPerfil)
router.put('/perfil',         requireAuth, checkAtleta, validate(updatePerfilAtletaSchema), AtletaController.updatePerfil)
router.get('/solicitudes-club',     requireAuth, AtletaController.getSolicitudesClub)
router.post('/solicitudes-club',    requireAuth, checkAtleta, validate(solicitudClubSchema), AtletaController.crearSolicitudClub)
router.put('/solicitudes-club/:id', requireAuth, validate(procesarSolicitudSchema), AtletaController.procesarSolicitudClub)
router.post('/:id/invitar-club', requireAuth, checkClub, AtletaController.invitarClub)

//Rutas genericas
router.get('/',     AtletaController.getAll)
router.get('/:id',  AtletaController.getById)
router.put('/:id',       requireAuth, checkAdmin, validate(updateAdminAtletaSchema), AtletaController.updateAdmin)
router.put('/:id/club',  requireAuth, validate(updateClubAtletaSchema), AtletaController.updateClub)
router.delete('/:id',    requireAuth, AtletaController.remove)


export default router