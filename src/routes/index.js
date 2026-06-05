import { Router } from 'express'
import authRoutes        from './auth.routes.js'
import clubRoutes        from './club.routes.js'
import entrenadorRoutes  from './entrenador.routes.js'
import entrenadoresRoutes from './entrenadores.routes.js'
import eventoRoutes      from './evento.routes.js'

const router = Router()

router.use('/auth',        authRoutes)
router.use('/clubes',      clubRoutes)
router.use('/entrenador',  entrenadorRoutes)
router.use('/entrenadores', entrenadoresRoutes)
router.use('/eventos',     eventoRoutes)

export { router }