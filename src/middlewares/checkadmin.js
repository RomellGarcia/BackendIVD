import { pool } from '../config/db.js'

export const checkAdmin = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id AS usuario_id, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.supabase_uid = $1`,
      [req.user.id]
    )
    if (!rows[0] || rows[0].rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' })
    }
    req.usuarioId = rows[0].usuario_id
    next()
  } catch (err) { next(err) }
}