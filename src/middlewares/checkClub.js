import { resolverClubPorEmail } from '../utils/resolverUsuario.js'

export const checkClub = async (req, res, next) => {
  try {
    const club = await resolverClubPorEmail(req.user.email)
    if (!club) return res.status(403).json({ error: 'No tienes perfil de club' })
    req.clubId = club.club_id
    next()
  } catch (err) { next(err) }
}