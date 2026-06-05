import { pool } from '../config/db.js'

export const checkEntrenador = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id AS entrenador_id, u.id AS usuario_id
       FROM usuarios u
       JOIN entrenadores e ON e.usuario_id = u.id
       WHERE u.supabase_uid = $1`,
      [req.user.id]
    )

    if (!rows[0]) {
      return res.status(403).json({ error: 'No tienes perfil de entrenador' })
    }

    req.entrenadorId = rows[0].entrenador_id
    req.usuarioId    = rows[0].usuario_id
    next()
  } catch (err) {
    next(err)
  }
}