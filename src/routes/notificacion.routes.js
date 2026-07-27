import { Router } from 'express'
import * as NotificacionController from '../controllers/notificacion.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { checkAtleta } from '../middlewares/checkAtleta.js'
import { checkClub } from '../middlewares/checkClub.js'

const router = Router()

// Rutas de notificaciones para atletas
router.get('/mias', requireAuth, checkAtleta, NotificacionController.getMisNotificaciones)
router.put('/marcar-leidas', requireAuth, checkAtleta, NotificacionController.marcarLeidas)

// Rutas de notificaciones para clubes
router.get('/club/mias', requireAuth, checkClub, NotificacionController.getMisNotificacionesClub) 
router.put('/club/marcar-leidas', requireAuth, checkClub, NotificacionController.marcarLeidasClub)

export default router