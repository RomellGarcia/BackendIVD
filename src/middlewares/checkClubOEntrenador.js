import { pool } from '../config/db.js'
import { resolverClubPorEmail } from '../utils/resolverUsuario.js'

export const checkClubOEntrenador = async (req, res, next) => {
  try {
    const club = await resolverClubPorEmail(req.user.email)
    if (club) {
      req.clubId = club.club_id
      return next()
    }

    const { rows: usuarioRows } = await pool.query(
      `SELECT id AS usuario_id FROM usuarios WHERE supabase_uid = $1`,
      [req.user.id]
    )
    if (usuarioRows[0]) {
      const { rows: entrenadorRows } = await pool.query(
        `SELECT id AS entrenador_id FROM entrenadores WHERE usuario_id = $1`,
        [usuarioRows[0].usuario_id]
      )
      if (entrenadorRows[0]) {
        req.entrenadorId = entrenadorRows[0].entrenador_id
        return next()
      }
    }

    return res.status(403).json({ error: 'No tienes permisos para esta acción' })
  } catch (err) { next(err) }
}