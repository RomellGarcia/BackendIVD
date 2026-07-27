import { Router } from 'express'
import * as CatalogosController from '../controllers/catalogos.controller.js'

const router = Router()

// Obtiene todas las disciplinas deportivas
router.get('/disciplinas', CatalogosController.getDisciplinas)
// Obtiene todas las categorías disponibles
router.get('/categorias', CatalogosController.getCategorias)
// Obtiene todos los géneros (masculino, femenino, etc.)
router.get('/generos', CatalogosController.getGeneros)

export default router