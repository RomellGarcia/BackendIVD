import { pool } from '../config/db.js'
import { supabase } from '../config/supabase.js'

//Genera un código de 6 dígitos y lo guarda con 15 minutos de vigencia
//Genera un código de 6 dígitos y lo guarda con 15 minutos de vigencia
//(el "ya expiró en" lo calcula Postgres con su propio reloj, para que
//nunca se desincronice con la zona horaria de la máquina que corre Node)
export const crearCodigo = async (email) => {
  const codigo = Math.floor(100000 + Math.random() * 900000).toString()

  await pool.query(`DELETE FROM codigos_recuperacion WHERE expira_en < NOW()`)
  await pool.query(`DELETE FROM codigos_recuperacion WHERE email = $1 AND usado = false`, [email])

  await pool.query(
    `INSERT INTO codigos_recuperacion (email, codigo, expira_en)
     VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
    [email, codigo]
  )
  return codigo
}

//Busca el usuario por email (para saber su nombre y su supabase_uid)
export const findUsuarioPorEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT id, nombre, email, supabase_uid FROM usuarios WHERE email = $1`,
    [email]
  )
  return rows[0] || null
}

//Verifica que el código sea válido, no haya expirado y no se haya usado antes
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

export const marcarCodigoUsado = async (id) => {
  await pool.query(`UPDATE codigos_recuperacion SET usado = true WHERE id = $1`, [id])
}

//Cambia la contraseña real del usuario en Supabase Auth. Requiere el
//cliente creado con SUPABASE_SERVICE_ROLE_KEY (el único con permiso
//para actualizar la contraseña de otra cuenta).
export const actualizarPasswordSupabase = async (supabaseUid, nuevaPassword) => {
  const { error } = await supabase.auth.admin.updateUserById(supabaseUid, { password: nuevaPassword })
  if (error) throw new Error(error.message)
}