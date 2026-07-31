import { pool } from '../config/db.js'

// Resuelve el usuario y su rol a partir del supabase_uid del token
export const resolverUsuarioPorSupabaseUid = async (supabaseUid) => {
  const { rows } = await pool.query(
    `SELECT u.id AS usuario_id, r.nombre AS rol
     FROM usuarios u
     JOIN roles r ON u.rol_id = r.id
     WHERE u.supabase_uid = $1`,
    [supabaseUid]
  )
  return rows[0] || null
}

// Resuelve el club activo a partir del email del usuario
export const resolverClubPorEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT id AS club_id FROM clubes WHERE email = $1 AND estado = 'activo'`,
    [email]
  )
  return rows[0] || null
}