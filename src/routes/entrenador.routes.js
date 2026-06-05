import { Router } from 'express'
import * as EntrenadorController from '../controllers/entrenador.controller.js'
import { requireAuth }      from '../middlewares/auth.js'
import { checkEntrenador }  from '../middlewares/checkEntrenador.js'
import { validate }         from '../middlewares/validate.js'
import { updatePerfilSchema, solicitudClubSchema } from '../schemas/entrenador.schema.js'

const router = Router()

//Todas las rutas del entrenador requieren auth y perfil de entrenador
router.use(requireAuth, checkEntrenador)

router.get('/perfil',     EntrenadorController.getPerfil)
router.get('/stats',      EntrenadorController.getStats)
router.get('/actividad',  EntrenadorController.getActividad)
router.get('/atletas',    EntrenadorController.getAtletas)
router.get('/solicitudes', EntrenadorController.getSolicitudes)

router.put('/perfil',     validate(updatePerfilSchema),  EntrenadorController.updatePerfil)
router.post('/solicitar-club', validate(solicitudClubSchema), EntrenadorController.solicitarClub)

export default router