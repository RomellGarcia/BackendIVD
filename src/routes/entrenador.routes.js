import { Router } from 'express'
import * as EntrenadorController from '../controllers/entrenador.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { checkEntrenador } from '../middlewares/checkEntrenador.js'
import { validate } from '../middlewares/validate.js'
import { updatePerfilSchema, solicitudClubSchema } from '../schemas/entrenador.schema.js'

const router = Router()

// Rutas públicas (usadas en formulario de registro)
router.get('/certificaciones-sugeridas', EntrenadorController.getCertificacionesSugeridas)
router.get('/especialidades-sugeridas', EntrenadorController.getEspecialidadesSugeridas)

// Rutas protegidas (requieren autenticación y rol entrenador)
router.use(requireAuth, checkEntrenador)

// Perfil y estadísticas
router.get('/perfil', EntrenadorController.getPerfil)
router.get('/stats', EntrenadorController.getStats)
router.get('/actividad', EntrenadorController.getActividad)

// Solicitudes del entrenador
+router.get('/solicitudes', EntrenadorController.getSolicitudes)

// Actualizaciones y acciones
router.put('/perfil', validate(updatePerfilSchema), EntrenadorController.updatePerfil)
router.post('/solicitar-club', validate(solicitudClubSchema), EntrenadorController.solicitarClub)
router.post('/salir-club', EntrenadorController.salirClub)

export default router