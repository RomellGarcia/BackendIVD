import { pool } from '../config/db.js'

export const checkAdminOClub = async (req, res, next) => {
  try {
    const { rows: usuarioRows } = await pool.query(
      `SELECT u.id AS usuario_id, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.supabase_uid = $1`,
      [req.user.id]
    )
    const usuario = usuarioRows[0]

    if (usuario?.rol === 'admin') {
      req.esAdmin = true
      req.usuarioId = usuario.usuario_id
      return next()
    }

    const { rows: clubRows } = await pool.query(
      `SELECT id AS club_id FROM clubes WHERE email = $1 AND estado = 'activo'`,
      [req.user.email]
    )
    if (clubRows[0]) {
      req.esAdmin = false
      req.clubId = clubRows[0].club_id
      return next()
    }

    return res.status(403).json({ error: 'No tienes permisos para esta acción' })
  } catch (err) { next(err) }
}