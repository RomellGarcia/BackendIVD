import { pool } from '../config/db.js'
import { supabase } from '../config/supabase.js'

// Genera código de 6 dígitos con vigencia de 15 minutos (expiración calculada en Postgres)
export const crearCodigo = async (email) => {
  const codigo = Math.floor(100000 + Math.random() * 900000).toString()

  // Limpieza de códigos expirados o previos no usados
  await pool.query(`DELETE FROM codigos_recuperacion WHERE expira_en < NOW()`)
  await pool.query(`DELETE FROM codigos_recuperacion WHERE email = $1 AND usado = false`, [email])

  await pool.query(
    `INSERT INTO codigos_recuperacion (email, codigo, expira_en)
     VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
    [email, codigo]
  )
  return codigo
}

// Busca usuario por email para obtener nombre y supabase_uid
export const findUsuarioPorEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT id, nombre, email, supabase_uid FROM usuarios WHERE email = $1`,
    [email]
  )
  return rows[0] || null
}

// Verifica que el código sea válido, no expirado y no usado
export const validarCodigo = async (email, codigo) => {
  const { rows } = await pool.query(
    `SELECT id FROM codigos_recuperacion
     WHERE email = $1 AND codigo = $2 AND usado = false AND expira_en > NOW()
     ORDER BY fecha_creacion DESC
     LIMIT 1`,
    [email, codigo]
  )
  return rows[0] || null
}

// Marca el código como usado para evitar reutilización
export const marcarCodigoUsado = async (id) => {
  await pool.query(`UPDATE codigos_recuperacion SET usado = true WHERE id = $1`, [id])
}

// Actualiza la contraseña en Supabase Auth (requiere service role key)
export const actualizarPasswordSupabase = async (supabaseUid, nuevaPassword) => {
  const { error } = await supabase.auth.admin.updateUserById(supabaseUid, { password: nuevaPassword })
  if (error) throw new Error(error.message)
}