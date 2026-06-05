import { pool } from '../config/db.js'

export const checkAtleta = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id AS atleta_id, u.id AS usuario_id
       FROM usuarios u
       JOIN atletas a ON a.usuario_id = u.id
       WHERE u.supabase_uid = $1`,
      [req.user.id]
    )
    if (!rows[0]) return res.status(403).json({ error: 'No tienes perfil de atleta' })
    req.atletaId  = rows[0].atleta_id
    req.usuarioId = rows[0].usuario_id
    next()
  } catch (err) { next(err) }
}