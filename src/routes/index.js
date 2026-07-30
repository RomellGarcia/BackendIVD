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
import catalogosRoutes         from './catalogos.routes.js'
import notificacionRoutes      from './notificacion.routes.js'
import recuperarRoutes         from './recuperarPassword.routes.js'
import adminRoutes             from './admin.routes.js'

const router = Router()

// Autenticación y usuarios
router.use('/auth', authRoutes)
// Gestión de clubes
router.use('/clubes', clubRoutes)
// Atletas (perfil y solicitudes)
router.use('/atletas', atletaRoutes)
// Entrenador (perfil propio)
router.use('/entrenador', entrenadorRoutes)
// Entrenadores (administración y listados)
router.use('/entrenadores', entrenadoresRoutes)
// Eventos y convocatorias
router.use('/eventos', eventoRoutes)
// Resultados y estadísticas
router.use('/resultados', resultadoRoutes)
// Contenido estático (misión, visión, etc.)
router.use('/contenido', contenidoEstaticoRoutes)
// Perfil de la empresa
router.use('/perfil-empresa', perfilEmpresaRoutes)
// Catálogos (disciplinas, categorías, géneros)
router.use('/catalogos', catalogosRoutes)
// Notificaciones
router.use('/notificaciones', notificacionRoutes)
// Recuperación de contraseña
router.use('/recuperar', recuperarRoutes)
// Administradores (listar y crear)
router.use('/admins', adminRoutes)

export { router }