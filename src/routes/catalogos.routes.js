import { Router } from 'express'
import * as CatalogosController from '../controllers/catalogos.controller.js'

const router = Router()

// Públicas — cualquiera puede leerlas, se usan en formularios (crear
// eventos, filtros de convocatorias, etc.)
router.get('/disciplinas', CatalogosController.getDisciplinas)
router.get('/categorias',  CatalogosController.getCategorias)
router.get('/generos',     CatalogosController.getGeneros)

export default router