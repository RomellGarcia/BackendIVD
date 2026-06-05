import { Router } from 'express'
import authRoutes from './auth.routes.js'
import clubRoutes from './club.routes.js'

const router = Router()

router.use('/auth',   authRoutes)
router.use('/clubes', clubRoutes)

export { router }