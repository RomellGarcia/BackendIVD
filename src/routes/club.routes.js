import { Router } from 'express'
import * as ClubController from '../controllers/club.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { validate }    from '../middlewares/validate.js'
import { createClubSchema, updateClubSchema } from '../schemas/club.schema.js'

const router = Router()

// Rutas públicas (sin autenticación)
router.get('/',    ClubController.getAll)
router.get('/:id', ClubController.getById)
router.get('/:id/atletas',      ClubController.getAtletas)
router.get('/:id/entrenadores', ClubController.getEntrenadores)

// Rutas protegidas (requieren autenticación y permisos de administrador)
router.post('/',     requireAuth, validate(createClubSchema), ClubController.create)
router.put('/:id',   requireAuth, validate(updateClubSchema),  ClubController.update)
router.delete('/:id', requireAuth, ClubController.remove)

export default router