import { Router } from 'express'
import * as AtletaController from '../controllers/atleta.controller.js'
import { requireAuth }   from '../middlewares/auth.js'
import { checkAtleta }   from '../middlewares/checkAtleta.js'
import { checkAdmin }    from '../middlewares/checkAdmin.js'
import { checkClub }     from '../middlewares/checkClub.js'
import { checkAdminOClub } from '../middlewares/checkAdminOClub.js'
import { validate }      from '../middlewares/validate.js'
import {
  updatePerfilAtletaSchema,
  solicitudClubSchema,
  procesarSolicitudSchema,
  updateClubAtletaSchema,
  updateAdminAtletaSchema
} from '../schemas/atleta.schema.js'

const router = Router()

// Rutas de perfil del atleta autenticado
router.get('/perfil',  requireAuth, checkAtleta, AtletaController.getPerfil)
router.put('/perfil',  requireAuth, checkAtleta, validate(updatePerfilAtletaSchema), AtletaController.updatePerfil)

// Solicitudes de club (propias del atleta)
router.get('/solicitudes-club',          requireAuth, AtletaController.getSolicitudesClub)
router.post('/solicitudes-club',         requireAuth, checkAtleta, validate(solicitudClubSchema), AtletaController.crearSolicitudClub)
router.put('/solicitudes-club/:id',      requireAuth, validate(procesarSolicitudSchema), AtletaController.procesarSolicitudClub)

// Club invita a un atleta (acción del club)
router.post('/:id/invitar-club', requireAuth, checkClub, AtletaController.invitarClub)

// Rutas públicas (listado y detalle)
router.get('/',     AtletaController.getAll)
router.get('/:id',  AtletaController.getById)

// Rutas administrativas (requieren admin)
router.put('/:id',       requireAuth, checkAdmin, validate(updateAdminAtletaSchema), AtletaController.updateAdmin)
router.put('/:id/club',  requireAuth, checkAdminOClub, validate(updateClubAtletaSchema), AtletaController.updateClub)
router.delete('/:id',    requireAuth, AtletaController.remove)

export default router