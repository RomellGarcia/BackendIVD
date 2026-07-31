import { resolverUsuarioPorSupabaseUid, resolverClubPorEmail } from '../utils/resolverUsuario.js'

export const checkAdminOClub = async (req, res, next) => {
  try {
    const usuario = await resolverUsuarioPorSupabaseUid(req.user.id)
    if (usuario?.rol === 'admin') {
      req.esAdmin = true
      req.usuarioId = usuario.usuario_id
      return next()
    }

    const club = await resolverClubPorEmail(req.user.email)
    if (club) {
      req.esAdmin = false
      req.clubId = club.club_id
      return next()
    }

    return res.status(403).json({ error: 'No tienes permisos para esta acción' })
  } catch (err) { next(err) }
}