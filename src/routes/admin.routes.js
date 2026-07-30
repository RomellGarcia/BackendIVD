import { Router } from 'express'
import * as AdminController from '../controllers/admin.controller.js'
import { requireAuth } from '../middlewares/auth.js'
import { checkAdmin } from '../middlewares/checkAdmin.js'
import { validate } from '../middlewares/validate.js'
import { crearAdminSchema } from '../schemas/auth.schema.js'

const router = Router()

router.get('/', requireAuth, checkAdmin, AdminController.getAll)
router.post('/', requireAuth, checkAdmin, validate(crearAdminSchema), AdminController.crear)

export default router