import { pool } from '../config/db.js'

export const findBySupabaseUid = async (supabaseUid) => {
  const { rows } = await pool.query(
    `SELECT 
      u.id,
      u.nombre,
      u.apellido_paterno,
      u.apellido_materno,
      u.email,
      u.supabase_uid,
      u.telefono,
      u.curp,
      u.fecha_nacimiento,
      u.estado_nacimiento,
      r.nombre AS rol,
      g.nombre AS genero
     FROM usuarios u
     JOIN roles r ON u.rol_id = r.id
     LEFT JOIN generos g ON u.genero_id = g.id
     WHERE u.supabase_uid = $1`,
    [supabaseUid]
  )
  return rows[0] || null
}