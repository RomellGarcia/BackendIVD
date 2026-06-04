import { pool } from '../config/db.js'

// Se llama después de que el trigger ya insertó el row base
// Solo lo usamos para leer datos enriquecidos del usuario
export const findBySupabaseUid = async (supabaseUid) => {
  const { rows } = await pool.query(
    `SELECT 
      u.id,
      u.nombre,
      u.apellido_paterno,
      u.apellido_materno,
      u.email,
      u.supabase_uid,
      r.nombre AS rol
     FROM usuarios u
     JOIN roles r ON u.rol_id = r.id
     WHERE u.supabase_uid = $1`,
    [supabaseUid]
  )
  return rows[0] || null
}