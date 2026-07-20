import { Router } from 'express'
import authRoutes              from './auth.routes.js'
import clubRoutes              from './club.routes.js'
import atletaRoutes            from './atleta.routes.js'
import entrenadorRoutes        from './entrenador.routes.js'
import entrenadoresRoutes      from './entrenadores.routes.js'
import eventoRoutes            from './evento.routes.js'
import resultadoRoutes         from './resultado.routes.js'
import contenidoEstaticoRoutes from './contenidoEstatico.routes.js'
import perfilEmpresaRoutes     from './perfilEmpresa.routes.js'
import catalogosRoutes from './catalogos.routes.js'
import notificacionRoutes from './notificacion.routes.js'
import recuperarRoutes from './recuperarPassword.routes.js'

const router = Router()

router.use('/auth',           authRoutes)
router.use('/clubes',         clubRoutes)
router.use('/atletas',        atletaRoutes)
router.use('/entrenador',     entrenadorRoutes)
router.use('/entrenadores',   entrenadoresRoutes)
router.use('/eventos',        eventoRoutes)
router.use('/resultados',     resultadoRoutes)
router.use('/contenido',      contenidoEstaticoRoutes)
router.use('/perfil-empresa', perfilEmpresaRoutes)
router.use('/catalogos', catalogosRoutes)
router.use('/notificaciones', notificacionRoutes)
router.use('/recuperar', recuperarRoutes)


export { router }