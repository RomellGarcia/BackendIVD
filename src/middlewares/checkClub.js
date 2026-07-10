import { pool } from '../config/db.js'

export const checkClub = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id AS club_id
       FROM clubes
       WHERE email = $1 AND estado = 'activo'`,
      [req.user.email]
    )
    if (!rows[0]) return res.status(403).json({ error: 'No tienes perfil de club' })
    req.clubId = rows[0].club_id
    next()
  } catch (err) { next(err) }
}