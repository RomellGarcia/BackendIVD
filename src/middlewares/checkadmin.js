import { resolverUsuarioPorSupabaseUid } from '../utils/resolverUsuario.js'

export const checkAdmin = async (req, res, next) => {
  try {
    const usuario = await resolverUsuarioPorSupabaseUid(req.user.id)
    if (!usuario || usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' })
    }
    req.usuarioId = usuario.usuario_id
    next()
  } catch (err) { next(err) }
}